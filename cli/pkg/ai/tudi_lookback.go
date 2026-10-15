package ai

import "time"

// TudiMaxLookback is how far back tudi-cli reads AI tool logs (tudi-tracker). Upstream starts a first sync at
// 2025-02-24 and reads every AI session on the computer, which took minutes on a busy machine; Tudi rewards only
// the last 24 hours (ADR-024 §12) and never needs activity from before the computer was linked.
const TudiMaxLookback = 24 * time.Hour

// tudiCutoff moves an AI log watermark forward so it is never older than TudiMaxLookback.
func tudiCutoff(parsed time.Time, now time.Time) time.Time {
	if earliest := now.Add(-TudiMaxLookback); parsed.Before(earliest) {
		return earliest
	}

	return parsed
}
