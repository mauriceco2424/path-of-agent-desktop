const DEFAULT_ORBIT_RADII = [0, 82, 162, 335, 493, 662, 846];
const DEFAULT_SKILLS_PER_ORBIT = [1, 6, 16, 16, 40, 72, 72];

export function calculateNodePosition(
  groupX: number,
  groupY: number,
  orbit: number,
  orbitIndex: number,
  orbitRadii: number[] = DEFAULT_ORBIT_RADII,
  skillsPerOrbit: number[] = DEFAULT_SKILLS_PER_ORBIT
): { x: number; y: number } {
  if (orbit === 0) {
    return { x: groupX, y: groupY };
  }

  const radius = orbitRadii[orbit] ?? 0;
  const skillsInOrbit = skillsPerOrbit[orbit] ?? 1;

  // Angle: start from top (negative Y), go clockwise
  const angle = (2 * Math.PI * orbitIndex) / skillsInOrbit - Math.PI / 2;

  return {
    x: groupX + radius * Math.cos(angle),
    y: groupY + radius * Math.sin(angle),
  };
}

export function calculateAllNodePositions(
  nodes: Record<string, { group?: string | number; orbit?: number; orbitIndex?: number }>,
  groups: Record<string, { x: number; y: number }>,
  orbitRadii?: number[],
  skillsPerOrbit?: number[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  for (const [nodeId, node] of Object.entries(nodes)) {
    const groupKey = String(node.group);
    const group = groups[groupKey];
    if (!group) continue;

    const pos = calculateNodePosition(
      group.x,
      group.y,
      node.orbit ?? 0,
      node.orbitIndex ?? 0,
      orbitRadii,
      skillsPerOrbit
    );
    positions.set(nodeId, pos);
  }

  return positions;
}
