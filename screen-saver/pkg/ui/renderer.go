package ui

import (
	"fmt"
	"image"

	"gioui.org/f32"
	"gioui.org/layout"
	"gioui.org/op"
	"gioui.org/op/clip"
	"gioui.org/op/paint"
	"gioui.org/widget/material"

	"github.com/xiaket/etc/screen-saver/pkg/config"
	"github.com/xiaket/etc/screen-saver/pkg/simulator"
)

// Renderer handles all drawing operations
type Renderer struct {
	theme *material.Theme
}

// NewRenderer creates a new renderer
func NewRenderer() (*Renderer, error) {
	theme := material.NewTheme()
	theme.Palette.Bg = config.ColorBackground
	theme.Palette.Fg = config.ColorText

	return &Renderer{
		theme: theme,
	}, nil
}

// DrawBackground fills the screen with black background
func (r *Renderer) DrawBackground(gtx layout.Context) {
	paint.Fill(gtx.Ops, config.ColorBackground)
}

// DrawProgressBalls renders all progress balls in a grid
func (r *Renderer) DrawProgressBalls(gtx layout.Context, sim *simulator.DownloadSimulator, gridLayout GridLayout) {
	blocks := sim.GetBlocks()

	// Calculate dynamic spacing based on screen size
	screenWidth := gtx.Constraints.Max.X
	screenHeight := gtx.Constraints.Max.Y
	spacingX := float64(screenWidth) / float64(gridLayout.Cols)
	spacingY := float64(screenHeight) / float64(gridLayout.Rows)

	blockIndex := 0
	for row := 0; row < gridLayout.Rows && blockIndex < len(blocks); row++ {
		for col := 0; col < gridLayout.Cols && blockIndex < len(blocks); col++ {
			// Calculate ball position with dynamic spacing
			x := int(float64(col)*spacingX + spacingX/2 - float64(config.BallSize)/2)
			y := int(float64(row)*spacingY + spacingY/2 - float64(config.BallSize)/2)

			// Draw the ball only if we have blocks left
			if blockIndex < len(blocks) {
				r.drawBall(gtx, x, y, config.BallSize, blocks[blockIndex])
				blockIndex++
			}
		}
	}
}

// drawBall renders a single progress ball
func (r *Renderer) drawBall(gtx layout.Context, x, y, size int, state simulator.BlockState) {
	// Draw as circle
	defer op.Offset(image.Pt(x, y)).Push(gtx.Ops).Pop()

	circle := clip.Ellipse{
		Min: image.Pt(0, 0),
		Max: image.Pt(size, size),
	}

	switch state {
	case simulator.BlockStateDownloading:
		defer circle.Op(gtx.Ops).Push(gtx.Ops).Pop()

		gradient := paint.LinearGradientOp{
			Stop1:  f32.Pt(0, float32(size)/2),             // Left side
			Stop2:  f32.Pt(float32(size), float32(size)/2), // Right side
			Color1: config.GradientColor1,                  // #0cc4cc
			Color2: config.GradientColor2,                  // #7d2ae8
		}
		gradient.Add(gtx.Ops)
		paint.PaintOp{}.Add(gtx.Ops)
	case simulator.BlockStateIdle:
		paint.FillShape(gtx.Ops, config.ColorIdle, circle.Op(gtx.Ops))
	case simulator.BlockStateCompleted:
		paint.FillShape(gtx.Ops, config.ColorCompleted, circle.Op(gtx.Ops))
	default:
		paint.FillShape(gtx.Ops, config.ColorIdle, circle.Op(gtx.Ops))
	}
}

// DrawCountdown renders countdown number in the center of screen
func (r *Renderer) DrawCountdown(gtx layout.Context, countdown int) {
	// Center the countdown number with large font
	layout.Center.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
		countdownText := fmt.Sprintf("%d", countdown)
		label := material.H1(r.theme, countdownText)
		label.Color = config.ColorCountdown
		// Make the text even larger by scaling
		label.TextSize = 120 // Very large text
		return label.Layout(gtx)
	})
}
