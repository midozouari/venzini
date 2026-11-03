// Reads docs/demo-script.md: one entry per "## Scene N – Name" with its on-screen title and its
// narration. The actions are free text for people; the robot's version of them is in scenes.ts.
import { readFileSync } from 'node:fs';

export interface Scene {
  n: number;
  name: string;
  title: string;
  narration: string;
}

export function readScript(path: string): Scene[] {
  const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  const parts = text.split(/^## Scene /m).slice(1);
  return parts.map((part) => {
    const head = /^(\d+)\s*[–-]\s*(.+)$/m.exec(part);
    const title = /^\*\*On-screen title:\*\*\s*(.+)$/m.exec(part);
    const narration = /\*\*Narration:\*\*\s*\n+"([\s\S]+?)"\s*(?:\n|$)/.exec(part);
    if (!head || !title || !narration)
      throw new Error(`docs/demo-script.md: scene "${part.slice(0, 40)}…" is missing a part.`);
    return {
      n: Number(head[1]),
      name: head[2]!.trim(),
      title: title[1]!.trim(),
      narration: narration[1]!.replace(/\s+/g, ' ').trim(),
    };
  });
}
