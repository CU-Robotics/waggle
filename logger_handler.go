package main

import (
	"bytes"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/rs/zerolog"
)

var reqCounter int64 = 0;

func LogRequest(wrappedWriter *ResponseWriterWrapper, r *http.Request, start time.Time, message string, name string, logger *zerolog.Event) {
	
	var millis float32 = float32(time.Since(start).Microseconds()) / 1000
	execTime := fmt.Sprintf("%.3f ms", millis)

	var data = map[string]any{
		"name":       name,
		"execTime":   execTime,
		"statusCode": wrappedWriter.StatusCode,
	}

	if wrappedWriter.StatusCode < 200 || wrappedWriter.StatusCode >= 400 {
		data["error"] = wrappedWriter.Body.String()
	}

	logger.Interface("data", data).Msg(message)
	reqCounter += 1;
	// println(reqCounter);
}

// ResponseWriterWrapper is a wrapper around http.ResponseWriter to capture the status code and response body
type ResponseWriterWrapper struct {
	http.ResponseWriter
	StatusCode int
	Body       *bytes.Buffer
}

// WriteHeader captures the status code
func (rw *ResponseWriterWrapper) WriteHeader(code int) {
	rw.StatusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// Write captures the response body
func (rw *ResponseWriterWrapper) Write(b []byte) (int, error) {
	if rw.Body == nil {
		rw.Body = &bytes.Buffer{}
	}
	rw.Body.Write(b)
	return rw.ResponseWriter.Write(b)
}

func LoggerHandler(next http.Handler, name string) http.Handler {
	consoleWriter := zerolog.ConsoleWriter{Out: os.Stdout}

	multi := zerolog.MultiLevelWriter(consoleWriter, os.Stdout)

	logger := zerolog.New(multi).With().Timestamp().Logger()

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		wrappedWriter := &ResponseWriterWrapper{ResponseWriter: w, StatusCode: http.StatusOK}
		defer func() {
			if err := recover(); err != nil { // recovery in case of crash
				http.Error(wrappedWriter, "Internal Server Error", http.StatusInternalServerError)
				LogRequest(wrappedWriter, r, start, fmt.Sprintf("Recovered from panic: %v\n", err), name, logger.Error())
			}
		}()
		next.ServeHTTP(wrappedWriter, r)

		if name != "VerifiedGet" { //Don't spam logs while users wait to be verified
			LogRequest(wrappedWriter, r, start, fmt.Sprintf("%s %s", r.Method, r.RequestURI), name, logger.Info())

		}
	})
}
