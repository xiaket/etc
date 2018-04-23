package main

import (
	"fmt"
	"os"
	"strings"
)

func main() {
	dir, _ := os.Getwd()
	dir = strings.Replace(dir, os.Getenv("HOME"), "~", 1)
	paths := strings.Split(dir, "/")
	short_paths := make([]string, len(paths))
	for i, path := range paths {
		if (len(path) < 2) || (i == len(paths)-1) {
			short_paths[i] = path
		} else {
			if strings.HasPrefix(path, ".") {
				short_paths[i] = path[:3]
			} else {
				short_paths[i] = path[:2]
			}
		}
	}
	short_name := strings.Join(short_paths, "/")

	fmt.Println(short_name)
}