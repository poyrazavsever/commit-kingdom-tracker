package ai

import (
	"os"
	"testing"
)

// TestMain runs the upstream AI parsing tests without Tudi's one-day lookback (tudi-tracker): their log fixtures are
// dated, and the lookback would hide them. TestTudiCutoff turns the limit back on for itself.
func TestMain(m *testing.M) {
	tudiLookback = 0

	os.Exit(m.Run())
}
