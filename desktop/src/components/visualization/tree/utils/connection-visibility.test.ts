import { describe, expect, it } from 'vitest';
import {
  isAscendantAlternateStartNode,
  shouldHideTreeConnection,
  type TreeConnectionNode,
} from './connection-visibility';

function createNode(overrides: Partial<TreeConnectionNode> = {}): TreeConnectionNode {
  return {
    name: 'Node',
    stats: [],
    ...overrides,
  };
}

describe('connection visibility', () => {
  it('identifies Ascendant alternate start nodes by name and ascendancy', () => {
    const node = createNode({
      name: 'Path of the Ranger',
      ascendancyName: 'Ascendant',
      stats: ["Can Allocate Passives from the Ranger's starting point"],
    });

    expect(isAscendantAlternateStartNode(node)).toBe(true);
  });

  it('does not flag regular Ascendant nodes as alternate starts', () => {
    const node = createNode({
      name: 'Assassin',
      ascendancyName: 'Ascendant',
    });

    expect(isAscendantAlternateStartNode(node)).toBe(false);
  });

  it('hides connections from Ascendant alternate starts into the main tree', () => {
    const fromNode = createNode({
      name: 'Path of the Shadow',
      ascendancyName: 'Ascendant',
      stats: ["Can Allocate Passives from the Shadow's starting point"],
    });
    const toNode = createNode({
      name: 'Damage and Energy Shield',
    });

    expect(shouldHideTreeConnection(fromNode, toNode)).toBe(true);
  });

  it('keeps internal ascendancy connections visible for alternate start nodes', () => {
    const fromNode = createNode({
      name: 'Path of the Templar',
      ascendancyName: 'Ascendant',
      stats: ["Can Allocate Passives from the Templar's starting point"],
    });
    const toNode = createNode({
      name: 'Skill Point',
      ascendancyName: 'Ascendant',
    });

    expect(shouldHideTreeConnection(fromNode, toNode)).toBe(false);
  });

  it('hides ascendancy start links back to the main tree', () => {
    const fromNode = createNode({
      name: 'Guardian',
      isAscendancyStart: true,
      ascendancyName: 'Guardian',
    });
    const toNode = createNode({
      name: 'TEMPLAR',
    });

    expect(shouldHideTreeConnection(fromNode, toNode)).toBe(true);
  });

  it('keeps internal ascendancy spokes from the ascendancy start visible', () => {
    const fromNode = createNode({
      name: 'Guardian',
      isAscendancyStart: true,
      ascendancyName: 'Guardian',
    });
    const toNode = createNode({
      name: 'Armour and Energy Shield, Aura Effect',
      ascendancyName: 'Guardian',
    });

    expect(shouldHideTreeConnection(fromNode, toNode)).toBe(false);
  });
});
