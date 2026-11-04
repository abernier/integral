import assert from 'node:assert/strict'
import { test } from 'node:test'

import { pickTool, resolveMachining, restTool, toolLimit, toolReach, type Tool } from './cam.machining.ts'

const tool = (number: number, diameter: number, fluteLength: number, stickout: number): Tool => ({
  number,
  description: `${diameter} mm`,
  diameter,
  fluteLength,
  stickout,
})

// Defaults: reach 1, nutClearance 5.
const machining = resolveMachining()
const narrowShort = tool(1, 3, 12, 30)
const narrowLong = tool(2, 3, 22, 40)
const wide = tool(3, 6, 32, 50)
const tools = [wide, narrowLong, narrowShort]

test('a tool cuts as deep as the shorter of its flutes and its stickout less the nut clearance', () => {
  assert.equal(toolLimit(tool(9, 6, 40, 30), machining), 25)
  assert.equal(toolLimit(tool(9, 6, 20, 30), machining), 20)
  assert.equal(toolReach(tool(9, 6, 40, 30), machining), 25)
  assert.equal(toolReach(tool(9, 6, 20, 30), machining), 19)
})

test('the narrowest tool that reaches the cut is picked, the shorter of two as narrow', () => {
  assert.equal(pickTool(tools, 10, machining), narrowShort)
  assert.equal(pickTool(tools, 18, machining), narrowLong)
  assert.equal(pickTool(tools, 25, machining), wide)
})

test('no tool is picked when none reaches the cut', () => {
  assert.throws(() => pickTool(tools, 40, machining), /no tool cuts 40\.0 mm deep/)
})

test('an explicit tool too short for the cut is refused', () => {
  assert.equal(pickTool(tools, 10, resolveMachining({ tool: 3 })), wide)
  assert.throws(() => pickTool(tools, 18, resolveMachining({ tool: 1 })), /tool #1 cuts 11 mm deep at most/)
})

test('no rest tool when the main tool is already the narrowest', () => {
  assert.equal(restTool(tools, narrowShort), undefined)
  assert.equal(restTool(tools, wide)?.diameter, 3)
})
