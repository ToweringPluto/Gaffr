import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { TextInput, TouchableOpacity, Text } from 'react-native';
import fc from 'fast-check';
import { FplApiError } from '../data/fplApiClient';

/**
 * For any FplApiError with a non-404 statusCode (generated from 400-599
 * excluding 404), the error handling SHALL display
 * "FPL API ERROR. TRY AGAIN LATER."
 */

const mockGetManagerSquad = jest.fn();
const mockSetTeamId = jest.fn().mockResolvedValue(undefined);

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

/**
 * Arbitrary: HTTP status codes 400-599 excluding 404.
 * These represent non-"not found" API errors.
 */
const nonNotFoundStatusCodeArb = fc
  .integer({ min: 400, max: 599 })
  .filter((code) => code !== 404);

describe('Property 1: Non-404 FplApiError shows "FPL API ERROR. TRY AGAIN LATER."', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetTeamId.mockResolvedValue(undefined);
  });

  it('for any non-404 status code (400-599), the displayed error is "FPL API ERROR. TRY AGAIN LATER."', async () => {
    await fc.assert(
      fc.asyncProperty(nonNotFoundStatusCodeArb, async (statusCode) => {
        mockGetManagerSquad.mockRejectedValue(
          new FplApiError(`FPL API returned ${statusCode}`, statusCode, '/api/entry/1/'),
        );

        let renderer: ReactTestRenderer | undefined;

        await act(async () => {
          renderer = create(
            React.createElement(TeamIdScreen, {
              onLinked: jest.fn(),
              onSkip: jest.fn(),
            }),
          );
        });

        const root = renderer!.root;

        // Enter a valid team ID
        const textInput = root.findByType(TextInput);
        await act(async () => {
          textInput.props.onChangeText('12345');
        });

        // Press the LINK TEAM button
        const buttons = root.findAllByType(TouchableOpacity);
        const linkButton = buttons.find((b) => {
          try {
            const texts = b.findAllByType(Text);
            return texts.some((t) => t.props.children === 'LINK TEAM');
          } catch {
            return false;
          }
        });

        await act(async () => {
          linkButton!.props.onPress();
        });

        // Find the error text
        const allTexts = root.findAllByType(Text);
        const errorText = allTexts.find(
          (t) => t.props.children === 'FPL API ERROR. TRY AGAIN LATER.',
        );

        expect(errorText).toBeDefined();

        // Clean up renderer to avoid state leaking between iterations
        await act(async () => {
          renderer!.unmount();
        });
      }),
      { numRuns: 50 },
    );
  });
});


/**
 * For any FplApiError with statusCode === 404, the error handling SHALL
 * continue to display "TEAM ID NOT RECOGNISED. CHECK AND TRY AGAIN.",
 * preserving the existing invalid-team-ID feedback.
 */
describe('Property 2: FplApiError with statusCode 404 shows "TEAM ID NOT RECOGNISED. CHECK AND TRY AGAIN."', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetTeamId.mockResolvedValue(undefined);
  });

  it('for statusCode 404, the displayed error is always "TEAM ID NOT RECOGNISED. CHECK AND TRY AGAIN."', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(404),
        async (statusCode) => {
          mockGetManagerSquad.mockRejectedValue(
            new FplApiError(`FPL API returned ${statusCode}`, statusCode, '/api/entry/99999999/'),
          );

          let renderer: ReactTestRenderer | undefined;

          await act(async () => {
            renderer = create(
              React.createElement(TeamIdScreen, {
                onLinked: jest.fn(),
                onSkip: jest.fn(),
              }),
            );
          });

          const root = renderer!.root;

          // Enter a team ID that will 404
          const textInput = root.findByType(TextInput);
          await act(async () => {
            textInput.props.onChangeText('99999999');
          });

          // Press the LINK TEAM button
          const buttons = root.findAllByType(TouchableOpacity);
          const linkButton = buttons.find((b) => {
            try {
              const texts = b.findAllByType(Text);
              return texts.some((t) => t.props.children === 'LINK TEAM');
            } catch {
              return false;
            }
          });

          await act(async () => {
            linkButton!.props.onPress();
          });

          // Verify the preservation message
          const allTexts = root.findAllByType(Text);
          const errorText = allTexts.find(
            (t) => t.props.children === 'TEAM ID NOT RECOGNISED. CHECK AND TRY AGAIN.',
          );

          expect(errorText).toBeDefined();

          await act(async () => {
            renderer!.unmount();
          });
        },
      ),
      { numRuns: 50 },
    );
  });
});
