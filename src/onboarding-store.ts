import * as fs from 'fs';
import * as path from 'path';

interface OnboardingState {
  onboarded: boolean;
}

function filePath(userDataDir: string): string {
  return path.join(userDataDir, 'onboarding.json');
}

export function hasOnboarded(userDataDir: string): boolean {
  try {
    const raw = fs.readFileSync(filePath(userDataDir), 'utf8');
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    return parsed.onboarded === true;
  } catch {
    return false;
  }
}

export function markOnboarded(userDataDir: string): void {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(filePath(userDataDir), JSON.stringify({ onboarded: true }, null, 2));
}
