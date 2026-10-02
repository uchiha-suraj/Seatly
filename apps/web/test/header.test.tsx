import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from './msw';
import { renderApp } from './render';

beforeEach(() => resetDb());

describe('app header', () => {
  it('marks the current page for assistive tech without a visual underline (matches Figma)', async () => {
    renderApp('/');
    const events = await screen.findByRole('link', { name: 'Events' });
    expect(events).toHaveAttribute('aria-current', 'page');
    expect(events.className).not.toMatch(/underline/);
    expect(await screen.findByRole('link', { name: 'My bookings' })).not.toHaveAttribute('aria-current');
  });
});
