package ai

import (
	"testing"
	"time"
)

func TestTudiCutoff_NeverReadsMoreThanADayBack(t *testing.T) {
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	upstreamFirstSync := time.Date(2025, time.February, 24, 0, 0, 0, 0, time.UTC)

	if got := tudiCutoff(upstreamFirstSync, now); !got.Equal(now.Add(-TudiMaxLookback)) {
		t.Errorf("first sync starts at %s, want %s", got, now.Add(-TudiMaxLookback))
	}

	recent := now.Add(-10 * time.Minute)
	if got := tudiCutoff(recent, now); !got.Equal(recent) {
		t.Errorf("a recent watermark must stay, got %s", got)
	}
}
