package heartbeat_test

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/wakatime/wakatime-cli/pkg/heartbeat"
)

func TestTudiPrivacy_SendsNothingThatIdentifiesAFileOrAProject(t *testing.T) {
	branch := "feature/acquisition"
	project := "secret-startup"
	line := 42
	h := heartbeat.Heartbeat{
		Entity:         `C:\Users\ada\secret-startup\src\Billing.TS`,
		EntityType:     heartbeat.FileType,
		Branch:         &branch,
		Project:        &project,
		Dependencies:   []string{"stripe"},
		LineNumber:     &line,
		Lines:          &line,
		CursorPosition: &line,
		AISession:      "session-1",
		AILineChanges:  heartbeat.PointerTo(5),
		// tudi-tracker: seen going out on 2026-10-17 before the privacy step removed them.
		AIInputTokens:       8145,
		AICachedInputTokens: 2963027,
		AIOutputTokens:      4759,
		AISubscriptionPlan:  "pro",
		Time:                1760520000,
	}

	sanitized := heartbeat.TudiPrivacy(h, []byte("0123456789abcdef0123456789abcdef"))
	data, err := json.Marshal(sanitized)
	if err != nil {
		t.Fatal(err)
	}

	sent := string(data)
	for _, secret := range []string{"ada", "secret-startup", "Billing", "acquisition", "stripe", "session-1", "lineno", "cursorpos", "tokens", "subscription", `"pro"`} {
		if strings.Contains(sent, secret) {
			t.Errorf("heartbeat still contains %q: %s", secret, sent)
		}
	}

	if sanitized.Entity != "HIDDEN.ts" {
		t.Errorf("entity = %q, want HIDDEN.ts", sanitized.Entity)
	}

	if !strings.HasPrefix(*sanitized.Project, "h:") || len(*sanitized.Project) != 34 {
		t.Errorf("project = %q, want h: and 32 hex characters", *sanitized.Project)
	}

	if *sanitized.AILineChanges != 5 {
		t.Errorf("AI line changes must be kept, got %d", *sanitized.AILineChanges)
	}
}

func TestHashProject_DependsOnTheSaltAndIsStable(t *testing.T) {
	a := heartbeat.HashProject("tudi", []byte("salt-a-salt-a-salt-a"))
	b := heartbeat.HashProject("tudi", []byte("salt-b-salt-b-salt-b"))

	if a == b {
		t.Error("two computers must not produce the same hash")
	}

	if a != heartbeat.HashProject("tudi", []byte("salt-a-salt-a-salt-a")) {
		t.Error("the same computer must produce the same hash")
	}

	if heartbeat.HashProject(a, []byte("other")) != a {
		t.Error("an already hashed project must pass through")
	}
}
