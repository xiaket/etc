package ui

import "github.com/xiaket/etc/screen-saver/pkg/config"

// GridLayout represents the calculated layout for the screen
type GridLayout struct {
	Rows int // Number of rows of balls
	Cols int // Number of columns of balls
}

// CalculateLayout calculates the optimal grid layout for the given screen dimensions
func CalculateLayout(screenWidth, screenHeight int) GridLayout {
	ballWithPadding := config.BallSize + config.BallPadding

	return GridLayout{
		Rows: screenHeight / ballWithPadding,
		Cols: screenWidth / ballWithPadding,
	}
}

// GetActualBlockCount returns the total number of blocks
func (gl GridLayout) GetActualBlockCount() int {
	return gl.Rows * gl.Cols
}