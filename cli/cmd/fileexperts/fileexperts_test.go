package fileexperts_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/wakatime/wakatime-cli/cmd/fileexperts"
	"github.com/wakatime/wakatime-cli/pkg/exitcode"
	"github.com/wakatime/wakatime-cli/pkg/log"
	"github.com/wakatime/wakatime-cli/pkg/log/setup"
	"github.com/wakatime/wakatime-cli/pkg/params"

	"github.com/spf13/viper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// tudi-tracker: file experts ("who knows this file") needs the file's path and project root, which the Tudi privacy
// step removes (pkg/heartbeat/tudi_privacy.go), and Tudi Daily has no such endpoint. So tudi-cli never asks: the
// upstream tests for the request, its errors and its output were replaced by the two tests below.

func TestRun_TudiNeverAsksForFileExperts(t *testing.T) {
	testServerURL, router, tearDown := setupTestServer()
	defer tearDown()

	var numCalls int

	router.HandleFunc("/users/current/file_experts", func(w http.ResponseWriter, _ *http.Request) {
		numCalls++

		w.WriteHeader(http.StatusInternalServerError)
	})

	v := viper.New()
	v.Set("key", "00000000-0000-4000-8000-000000000000")
	v.Set("api-url", testServerURL)
	v.Set("entity", "testdata/main.go")
	v.Set("projectmap..*", "wakatime-cli")

	code, err := fileexperts.Run(t.Context(), v)

	require.NoError(t, err)
	assert.Equal(t, exitcode.Success, code)
	assert.Zero(t, numCalls)
}

func TestFileExperts_TudiNeverAsks(t *testing.T) {
	testServerURL, router, tearDown := setupTestServer()
	defer tearDown()

	var numCalls int

	router.HandleFunc("/users/current/file_experts", func(w http.ResponseWriter, _ *http.Request) {
		numCalls++

		w.WriteHeader(http.StatusOK)
	})

	// lineno and write exercise the optional log fields in setLogFields.
	v := viper.New()
	v.Set("key", "00000000-0000-4000-8000-000000000000")
	v.Set("api-url", testServerURL)
	v.Set("entity", "testdata/main.go")
	v.Set("projectmap..*", "wakatime-cli")
	v.Set("plugin", "plugin/0.0.1")
	v.Set("lineno", 42)
	v.Set("write", true)

	output, err := fileexperts.FileExperts(t.Context(), v)

	require.NoError(t, err)
	assert.Empty(t, output)
	assert.Zero(t, numCalls)
}

func TestRunErr(t *testing.T) {
	v := viper.New()
	v.Set("entity", "testdata/main.go")

	code, err := fileexperts.Run(t.Context(), v)

	require.Error(t, err)
	assert.Equal(t, exitcode.ErrGeneric, code)
	assert.Contains(t, err.Error(), "file experts fetch failed")
}

func TestFileExperts_NonExistingEntity(t *testing.T) {
	ctx := t.Context()

	logFile, err := os.CreateTemp(t.TempDir(), "")
	require.NoError(t, err)

	defer logFile.Close()

	v := viper.New()
	v.Set("key", "00000000-0000-4000-8000-000000000000")
	v.Set("api-url", "https://example.org")
	v.Set("entity", "nonexisting")
	v.Set("log-file", logFile.Name())
	v.Set("verbose", true)

	logger, err := setup.Logging(ctx, v)
	require.NoError(t, err)

	defer logger.Flush()

	ctx = log.ToContext(ctx, logger)

	_, err = fileexperts.FileExperts(ctx, v)
	require.NoError(t, err)

	output, err := io.ReadAll(logFile)
	require.NoError(t, err)

	assert.Contains(t, string(output), "skipping because of non-existing file")
}

func TestFileExperts_ErrApiClient(t *testing.T) {
	// a missing ssl certs file makes the api client initialization fail.
	v := viper.New()
	v.Set("key", "00000000-0000-4000-8000-000000000000")
	v.Set("entity", "testdata/main.go")
	v.Set("ssl-certs-file", filepath.Join(t.TempDir(), "missing.pem"))

	_, err := fileexperts.FileExperts(t.Context(), v)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to initialize api client")
}

func TestLoadParams_ErrNilViper(t *testing.T) {
	_, err := fileexperts.LoadParams(t.Context(), nil, params.FlagReadOrderFlagPrecedence)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "viper instance unset")
}

func TestLoadParams_ErrHeartbeat(t *testing.T) {
	v := viper.New()
	v.Set("entity", "testdata/main.go")
	v.Set("category", "invalid")

	_, err := fileexperts.LoadParams(t.Context(), v, params.FlagReadOrderFlagPrecedence)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to load heartbeat params")
}

func TestLoadParams_ErrStatusBar(t *testing.T) {
	v := viper.New()
	v.Set("key", "00000000-0000-4000-8000-000000000000")
	v.Set("entity", "testdata/main.go")
	v.Set("output", "invalid")

	_, err := fileexperts.LoadParams(t.Context(), v, params.FlagReadOrderFlagPrecedence)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to load status bar params")
}

func setupTestServer() (string, *http.ServeMux, func()) {
	router := http.NewServeMux()
	srv := httptest.NewServer(router)

	return srv.URL, router, func() { srv.Close() }
}
