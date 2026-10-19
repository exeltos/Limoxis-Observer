// @vitest-environment jsdom
// Employee photo framing: an upload is cut to a square that keeps the face of a
// head-and-shoulders portrait (upper centre), the same framing the avatars use.
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { PHOTO_FOCUS_Y, squareCrop } from '../src/features/employees/employeePhotoService'

describe('employee photo square crop', () => {
  it('keeps the upper part of a portrait, a quarter of the spare height from the top', () => {
    expect(PHOTO_FOCUS_Y).toBe(0.25)
    expect(squareCrop(600, 800)).toEqual({ x: 0, y: 50, size: 600 })
    expect(squareCrop(300, 900)).toEqual({ x: 0, y: 150, size: 300 })
  })

  it('centres a landscape photo across', () => {
    expect(squareCrop(1200, 800)).toEqual({ x: 200, y: 0, size: 800 })
  })

  it('leaves a square photo whole and copes with missing sizes', () => {
    expect(squareCrop(512, 512)).toEqual({ x: 0, y: 0, size: 512 })
    expect(squareCrop(0, undefined)).toEqual({ x: 0, y: 0, size: 1 })
  })

  it('frames avatars on the same upper centre', () => {
    const css = fs.readFileSync('src/features/employees/employeePhoto.css', 'utf8')
    expect(css).toMatch(/\.employee-avatar img\{[^}]*object-fit:cover[^}]*object-position:50% 25%/)
  })
})
