package ai_test

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
