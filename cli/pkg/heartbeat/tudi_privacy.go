package heartbeat

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// Tudi Tracker privacy (tudi-tracker): applied to every heartbeat, after the upstream sanitization and whatever the
// config says. What leaves the computer is time, language, editor, write flag and line counts. The file name, branch,
// dependencies, line numbers, AI session, prompt length, token counts, the AI tool's plan and the real project name
// never do; the project is sent as a salted one-way hash.

const saltFile = ".tudi-salt"

var (
	saltOnce  sync.Once
	saltValue []byte
)

// WithTudiPrivacy returns a handle option that strips identifying data from heartbeats. home is the folder that
// keeps the per-computer salt (the user's home, or TUDI_HOME).
func WithTudiPrivacy(home string) HandleOption {
	return func(next Handle) Handle {
		return func(ctx context.Context, hh []Heartbeat) ([]Result, error) {
			salt := projectSalt(home)
			for n, h := range hh {
				hh[n] = TudiPrivacy(h, salt)
			}

			return next(ctx, hh)
		}
	}
}

// TudiPrivacy returns the heartbeat with only what Tudi needs. The entity keeps its extension (the server never sees
// the name), so nothing that identifies a file, a repository or a company is sent.
func TudiPrivacy(h Heartbeat, salt []byte) Heartbeat {
	if h.EntityType == FileType {
		h.Entity = "HIDDEN" + strings.ToLower(filepath.Ext(h.Entity))
	} else {
		h.Entity = "HIDDEN"
	}

	h.Branch = nil
	h.Dependencies = nil
	h.CursorPosition = nil
	h.LineNumber = nil
	h.Lines = nil
	h.ProjectRootCount = nil
	h.AISession = ""
	h.AIPromptLength = 0
	// Tokens and the AI tool's subscription plan say nothing about the work and are not Tudi's to know.
	h.AIInputTokens = 0
	h.AICachedInputTokens = 0
	h.AIOutputTokens = 0
	h.AISubscriptionPlan = ""

	if h.Project != nil && *h.Project != "" {
		hashed := HashProject(*h.Project, salt)
		h.Project = &hashed
	}

	return h
}

// HashProject turns a project name into "h:" and 32 hex characters. The salt is random per computer, so the same
// name gives different hashes on different machines and cannot be looked up in a table.
func HashProject(name string, salt []byte) string {
	if strings.HasPrefix(name, "h:") {
		return name
	}

	mac := hmac.New(sha256.New, salt)
	_, _ = mac.Write([]byte(name))

	return "h:" + hex.EncodeToString(mac.Sum(nil))[:32]
}

// projectSalt reads the computer's salt, creating it on first use. If it cannot be stored, a salt for this run is
// used, so a project never leaves unhashed.
func projectSalt(home string) []byte {
	saltOnce.Do(func() {
		path := filepath.Join(home, saltFile)
		if data, err := os.ReadFile(path); err == nil {
			if decoded, err := hex.DecodeString(strings.TrimSpace(string(data))); err == nil && len(decoded) >= 16 {
				saltValue = decoded

				return
			}
		}

		fresh := make([]byte, 32)
		_, _ = rand.Read(fresh)
		saltValue = fresh
		_ = os.WriteFile(path, []byte(hex.EncodeToString(fresh)), 0o600)
	})

	return saltValue
}
