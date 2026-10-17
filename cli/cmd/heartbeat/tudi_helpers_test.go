package heartbeat_test

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

// tudiEntity is what tudi-cli sends for a file (tudi-tracker): only its extension, never its name or folder.
func tudiEntity(path string) string {
	return "HIDDEN" + strings.ToLower(filepath.Ext(path))
}

// assertTudiProject checks that a project left the computer only as a salted hash (tudi-tracker).
func assertTudiProject(t *testing.T, project *string) {
	t.Helper()

	if assert.NotNil(t, project) {
		assert.Regexp(t, `^h:[0-9a-f]{32}$`, *project)
	}
}

// tudiPrivateFields are the heartbeat fields the Tudi privacy step removes (pkg/heartbeat/tudi_privacy.go).
var tudiPrivateFields = []string{"branch", "dependencies", "cursorpos", "lineno", "lines", "project_root_count", "ai_session", "ai_prompt_length"}

// applyTudiPrivacy turns an upstream request template into what tudi-cli sends (tudi-tracker): the private fields go,
// and a project is expected as a salted hash. The hash is random per computer, so once the actual project is checked
// to be one it is copied into the expectation.
func applyTudiPrivacy(t *testing.T, expected, actual any) {
	t.Helper()

	switch ev := expected.(type) {
	case []any:
		av, _ := actual.([]any)
		for i, child := range ev {
			var other any
			if i < len(av) {
				other = av[i]
			}

			applyTudiPrivacy(t, child, other)
		}
	case map[string]any:
		for _, field := range tudiPrivateFields {
			delete(ev, field)
		}

		if _, ok := ev["project"].(string); !ok {
			return
		}

		if av, ok := actual.(map[string]any); ok {
			if project, ok := av["project"].(string); ok {
				assertTudiProject(t, &project)
				ev["project"] = project
			}
		}
	}
}
