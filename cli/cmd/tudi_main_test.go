package cmd_test

import (
	"fmt"
	"os"
	"testing"
)

// TestMain gives the tests their own home folder (tudi-tracker), as cmd/heartbeat's tests do upstream. Without it the
// diagnostics tests wrote panics into the developer's real ~/.tudi/wakatime.log, which tudi-cli uses.
func TestMain(m *testing.M) {
	home, err := os.MkdirTemp("", "tudi-cli-cmd-test-home")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to create test home: %s\n", err)
		os.Exit(1)
	}

	_ = os.Setenv("HOME", home)
	_ = os.Setenv("USERPROFILE", home)
	_ = os.Unsetenv("TUDI_HOME")
	_ = os.Unsetenv("WAKATIME_HOME")

	code := m.Run()

	_ = os.RemoveAll(home)

	os.Exit(code)
}
