import { Command } from "commander";

import type { ScriptConfig } from "./utils";

const allScripts = new Set<string>();

export function registerScript(program: Command, script: ScriptConfig) {
  if (allScripts.has(script.name)) {
    throw Error(`Duplicate script name: ${script.name}`);
  }
  allScripts.add(script.name);

  const command = program
    .command(script.name)
    .description(script.description ?? script.name)
    .action(async (...args: unknown[]) => {
      try {
        const result = await script.handler(...args);
        if (result !== undefined) {
          console.log(JSON.stringify(result, null, 2));
        }
      } catch (e) {
        console.error(e);
      }
    });

  for (const argument of script.arguments) {
    command.addArgument(argument);
  }
  for (const option of script.options) {
    command.addOption(option);
  }
}

export async function parseProgramArgsAndRun(scripts: ScriptConfig[]) {
  const program = new Command();

  for (const script of scripts) {
    registerScript(program, script);
  }

  await program.parseAsync();
}
