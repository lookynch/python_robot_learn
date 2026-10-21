import { useState } from 'preact/hooks';
import { passedCheck } from '../content/checks';
import type { TestCase } from '../content/schema';
import type { RunResult } from '../python/protocol';
import { useRunner } from '../python/useRunner';

export function useCheck(
  expectOutput: string | undefined,
  tests: TestCase[] | undefined,
  stdin: string[] | undefined,
) {
  const runner = useRunner();
  const [verdict, setVerdict] = useState<{ passed: boolean; message: string | null } | null>(null);
  const check = async (code: string): Promise<boolean> => {
    setVerdict(null);
    const result: RunResult = await runner.run(code, { stdin, tests });
    if (result.status === 'stopped') return false;
    const outcome = passedCheck(result, expectOutput);
    setVerdict(outcome);
    return outcome.passed;
  };
  return { runner, verdict, check, reset: () => setVerdict(null) };
}
