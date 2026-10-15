// Package link links this computer to a Tudi Daily account (tudi-tracker, ADR-024): the app shows a short code, this
// command trades it for a device key and stores the key in ~/.tudi.cfg.
package link

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/wakatime/wakatime-cli/pkg/api"
	"github.com/wakatime/wakatime-cli/pkg/exitcode"
	"github.com/wakatime/wakatime-cli/pkg/ini"
	"github.com/wakatime/wakatime-cli/pkg/vipertools"

	"github.com/spf13/viper"
)

type request struct {
	Code       string `json:"code"`
	DeviceName string `json:"deviceName"`
	Editor     string `json:"editor,omitempty"`
}

type response struct {
	DeviceID string `json:"deviceId"`
	APIKey   string `json:"apiKey"`
}

// Run links the computer with the code given to --link and writes the device key to the config file.
func Run(ctx context.Context, v *viper.Viper) (int, error) {
	code := strings.TrimSpace(vipertools.GetString(v, "link"))
	if code == "" {
		return exitcode.ErrGeneric, errors.New("--link needs the code shown in the Tudi Daily app")
	}

	base := vipertools.FirstNonEmptyString(v, "api-url", "apiurl", "api_url", "settings.api_url")
	if base == "" {
		base = api.BaseURL
	}

	key, err := Link(ctx, LinkURL(base), code, deviceName(), vipertools.GetString(v, "plugin"))
	if err != nil {
		return exitcode.ErrGeneric, err
	}

	w, err := ini.NewWriter(ctx, v, ini.FilePath)
	if err != nil {
		return exitcode.ErrConfigFileParse, fmt.Errorf("failed to open config file: %w", err)
	}

	values := map[string]string{"api_key": key}
	if base != api.BaseURL {
		values["api_url"] = base
	}

	if err := w.Write(ctx, "settings", values); err != nil {
		return exitcode.ErrConfigFileParse, fmt.Errorf("failed to write config file: %w", err)
	}

	fmt.Println("Linked. Tudi will count your coding from now on.")

	return exitcode.Success, nil
}

// LinkURL turns the heartbeat API url (…/api/tracker/v1) into the link endpoint (…/api/tracker/link).
func LinkURL(base string) string {
	return strings.TrimSuffix(strings.TrimSuffix(base, "/"), "/v1") + "/link"
}

// Link trades a code for a device key.
func Link(ctx context.Context, url, code, device, editor string) (string, error) {
	body, _ := json.Marshal(request{Code: code, DeviceName: device, Editor: editorName(editor)})

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("could not reach Tudi Daily: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusBadRequest {
		return "", errors.New("that code is wrong, used or expired; get a new one in the app")
	}

	if resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("linking failed with status %d", resp.StatusCode)
	}

	var linked response
	if err := json.NewDecoder(resp.Body).Decode(&linked); err != nil || linked.APIKey == "" {
		return "", errors.New("unexpected answer from Tudi Daily")
	}

	return linked.APIKey, nil
}

func deviceName() string {
	name, err := os.Hostname()
	if err != nil || name == "" {
		return "Computer"
	}

	return name
}

// editorName keeps the editor family from a plugin string such as "vscode/1.95.0 vscode-wakatime/25.0.0".
func editorName(plugin string) string {
	fields := strings.Fields(plugin)
	if len(fields) == 0 {
		return ""
	}

	return strings.Split(fields[0], "/")[0]
}
