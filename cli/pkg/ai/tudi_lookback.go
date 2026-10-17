package ai

import "time"

// TudiMaxLookback is how far back tudi-cli reads AI tool logs (tudi-tracker). Upstream starts a first sync at
// 2025-02-24 and reads every AI session on the computer, which took minutes on a busy machine; Tudi rewards only
// the last 24 hours (ADR-024 §12) and never needs activity from before the computer was linked.
const TudiMaxLookback = 24 * time.Hour

// tudiLookback is TudiMaxLookback in tudi-cli. The upstream AI parsing tests read dated log fixtures, so they turn the
// limit off (tudi_main_test.go, SetTudiLookbackForTests); TestTudiCutoff checks the limit itself.
var tudiLookback = TudiMaxLookback

// SetTudiLookbackForTests changes the AI log lookback for tests in other packages; 0 turns the limit off. It returns
// the previous value. tudi-cli itself never calls it.
func SetTudiLookbackForTests(lookback time.Duration) time.Duration {
	previous := tudiLookback
	tudiLookback = lookback

	return previous
}

// tudiCutoff moves an AI log watermark forward so it is never older than the lookback.
func tudiCutoff(parsed time.Time, now time.Time) time.Time {
	if tudiLookback <= 0 {
		return parsed
	}

	if earliest := now.Add(-tudiLookback); parsed.Before(earliest) {
		return earliest
	}

	return parsed
}
