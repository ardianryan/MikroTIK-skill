import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ChatPromptExporter } from '../src/safety/prompt-export.js';

describe('ChatPromptExporter', () => {
  test('exports system prompt containing certified routeros guidelines', () => {
    const prompt = ChatPromptExporter.getSystemPrompt();
    assert.ok(prompt.length > 200, 'System prompt must be comprehensive');
    assert.ok(prompt.includes('RouterOS v7'), 'Must enforce RouterOS v7');
    assert.ok(prompt.includes('1-Click Copy-Paste CLI Output Standard'), 'Must enforce copy-paste standard');
    assert.ok(prompt.includes('Safe-Mode'), 'Must include safe-mode reminder');
  });
});
