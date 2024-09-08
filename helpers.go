package main

import (
	"encoding/json"
	"fmt"

	"github.com/rs/zerolog/log"
)

func protect(g func()) {
	defer func() {
		if x := recover(); x != nil {
			log.Printf("protected from run time panic: %v", x)
		}
	}()
	g()
}

func PrettyPrint(v interface{}) {
	// Marshal the struct with indentation
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		fmt.Println("error:", err)
		return
	}
	fmt.Println(string(b))
}
