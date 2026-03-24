import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { TextInput, TouchableOpacity, Text } from 'react-native';
import { FplApiError } from '../data/fplApiClient';

const mockGetManagerSquad = jest.fn();
const mockSetTeamId = jest.fn().mockResolvedValue(undefined);
const mockOnLinked = jest.fn();
const mockOnSkip = jest.fn();

jest.mock('../data/fplApiClient', () => {
  const actual = jest.requireActual('../data/fplApiClient');
  return {
    ...actual,
    createFplApiClient: () => ({
      getManagerSquad: (...args: unknown[]) => mockGetManagerSquad(...args),
    }),
  };
});

jest.mock('../data/localCache', () => ({
  createLocalCache: () => ({
    setTeamId: (...args: unknown[]) => mockSetTeamId(...args),
    getTeamId: jest.fn().mockResolvedValue(null),
  }),
}));

import { TeamIdScreen } from '../screens/TeamIdScreen';

/** Render the screen, type a value, and press LINK TEAM. */
async function submitTeamId(
  value: string,
  onLinked = mockOnLinked,
): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;

  await act(async () => {
    renderer = create(
      React.createElement(TeamIdScreen, { onLinked, onSkip: mockOnSkip }),
    );
  });

  const root = renderer.root;
  const textInput = root.findByType(TextInput);

  await act(async () => {
    textInput.props.onChangeText(value);
  });

  const linkButton = root
    .findAllByType(TouchableOpacity)
    .find((b) => {
      try {
        return b.findAllByType(Text).some((t) => t.props.children === 'LINK TEAM');
      } catch {
        return false;
      }
    });

  await act(async () => {
    linkButton!.props.onPress();
  });

  return renderer;
}

/** Find the displayed error message text, if any. */
function findErrorText(renderer: ReactTestRenderer): string | undefined {
  const allTexts = renderer.root.findAllByType(Text);
  const errorMessages = [
    'TEAM ID NOT RECOGNISED. CHECK AND TRY AGAIN.',
    'COULD NOT REACH FPL. CHECK YOUR CONNECTION.',
    'FPL API ERROR. TRY AGAIN LATER.',
    'ENTER A VALID TEAM ID (NUMBERS ONLY)',
  ];
  const match = allTexts.find((t) => errorMessages.includes(t.props.children));
  return match?.props.children as string | undefined;
}

describe('TeamIdScreen error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetTeamId.mockResolvedValue(undefined);
    mockOnLinked.mockReset();
  });

  // --- Error branch tests ---

  it('shows "TEAM ID NOT RECOGNISED" for FplApiError with statusCode 404', async () => {
    mockGetManagerSquad.mockRejectedValue(
      new FplApiError('FPL API returned 404', 404, '/api/entry/99999/'),
    );

    const renderer = await submitTeamId('99999');
    expect(findErrorText(renderer)).toBe('TEAM ID NOT RECOGNISED. CHECK AND TRY AGAIN.');

    await act(async () => renderer.unmount());
  });

  it('shows "COULD NOT REACH FPL" for FplApiError with no statusCode', async () => {
    mockGetManagerSquad.mockRejectedValue(
      new FplApiError('FPL API request failed: Network request failed'),
    );

    const renderer = await submitTeamId('12345');
    expect(findErrorText(renderer)).toBe('COULD NOT REACH FPL. CHECK YOUR CONNECTION.');

    await act(async () => renderer.unmount());
  });

  it('shows "FPL API ERROR" for FplApiError with statusCode 500', async () => {
    mockGetManagerSquad.mockRejectedValue(
      new FplApiError('FPL API returned 500', 500, '/api/entry/12345/'),
    );

    const renderer = await submitTeamId('12345');
    expect(findErrorText(renderer)).toBe('FPL API ERROR. TRY AGAIN LATER.');

    await act(async () => renderer.unmount());
  });

  it('shows "FPL API ERROR" for FplApiError with statusCode 403', async () => {
    mockGetManagerSquad.mockRejectedValue(
      new FplApiError('FPL API returned 403', 403, '/api/entry/12345/'),
    );

    const renderer = await submitTeamId('12345');
    expect(findErrorText(renderer)).toBe('FPL API ERROR. TRY AGAIN LATER.');

    await act(async () => renderer.unmount());
  });

  it('shows "FPL API ERROR" for a non-FplApiError', async () => {
    mockGetManagerSquad.mockRejectedValue(new TypeError('unexpected error'));

    const renderer = await submitTeamId('12345');
    expect(findErrorText(renderer)).toBe('FPL API ERROR. TRY AGAIN LATER.');

    await act(async () => renderer.unmount());
  });

  // --- Success path ---

  it('calls onLinked with the team ID on successful response', async () => {
    mockGetManagerSquad.mockResolvedValue({ id: 12345 });

    const renderer = await submitTeamId('12345');

    expect(mockGetManagerSquad).toHaveBeenCalledWith(12345);
    expect(mockSetTeamId).toHaveBeenCalledWith(12345);
    expect(mockOnLinked).toHaveBeenCalledWith(12345);
    expect(findErrorText(renderer)).toBeUndefined();

    await act(async () => renderer.unmount());
  });

  // --- Client-side validation ---

  describe('client-side validation rejects bad input', () => {
    it.each([
      ['empty string', ''],
      ['whitespace only', '   '],
      ['non-numeric', 'abc'],
      ['zero', '0'],
      ['negative number', '-5'],
      ['decimal number', '3.14'],
    ])('rejects %s', async (_label, value) => {
      const renderer = await submitTeamId(value);

      expect(mockGetManagerSquad).not.toHaveBeenCalled();
      expect(findErrorText(renderer)).toBe('ENTER A VALID TEAM ID (NUMBERS ONLY)');

      await act(async () => renderer.unmount());
    });
  });
});
