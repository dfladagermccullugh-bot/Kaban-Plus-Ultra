/**
 * @vitest-environment jsdom
 *
 * Axe-core a11y CI gate. We mount the most-trafficked client components in
 * jsdom and assert axe finds no violations. RSC routes can't be mounted
 * directly here (they hit Supabase) — for those we extract the presentational
 * client subtrees and exercise them in isolation.
 *
 * Adds the rendered subtree to a `<main>` landmark so axe doesn't flag
 * `region` for content not inside one.
 */

import { Button, Input, Label } from '@kpu/ui';
import { cleanup, render } from '@testing-library/react';
import axe, { type AxeResults, type ElementContext, type RunOptions } from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { SignInForm } from '../app/sign-in/sign-in-form';
import { ThemeToggle } from '../components/theme-toggle';

// Axe ships its own colour-contrast checker that needs computed styles. jsdom
// returns empty styles so contrast is flaky there — disable that one rule and
// rely on Lighthouse for the colour pass.
const AXE_OPTIONS: RunOptions = {
  rules: {
    'color-contrast': { enabled: false },
  },
};

async function expectNoViolations(node: Element) {
  const ctx: ElementContext = node as ElementContext;
  const results: AxeResults = await axe.run(ctx, AXE_OPTIONS);
  if (results.violations.length > 0) {
    const summary = results.violations
      .map((v) => `${v.id} (${v.impact ?? 'unknown'}): ${v.help}`)
      .join('\n');
    throw new Error(`axe found ${results.violations.length} violation(s):\n${summary}`);
  }
  expect(results.violations).toHaveLength(0);
}

function wrap(children: React.ReactNode) {
  return <main>{children}</main>;
}

afterEach(() => {
  cleanup();
});

describe('axe-core a11y gate', () => {
  it('UI primitives: Button / Input / Label compose a valid form field', async () => {
    const { container } = render(
      wrap(
        <form>
          <Label htmlFor="x">Example</Label>
          <Input id="x" name="x" type="email" autoComplete="email" />
          <Button type="submit">Submit</Button>
        </form>,
      ),
    );
    await expectNoViolations(container);
  });

  it('ThemeToggle exposes a labelled radio group', async () => {
    const { container } = render(wrap(<ThemeToggle />));
    await expectNoViolations(container);
  });

  it('SignInForm: idle state has accessible inputs and buttons', async () => {
    const { container } = render(wrap(<SignInForm next="/boards" />));
    await expectNoViolations(container);
  });
});
