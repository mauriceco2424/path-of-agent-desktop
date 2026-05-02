export interface TreeConnectionNode {
  name?: string;
  stats?: string[];
  ascendancyName?: string;
  isAscendancyStart?: boolean;
}

const ASCENDANT_ALTERNATE_START_NAME_PREFIX = 'Path of the ';
const ASCENDANT_ALTERNATE_START_STAT_PREFIX = 'Can Allocate Passives from the ';

export function isAscendantAlternateStartNode(node: TreeConnectionNode): boolean {
  if (node.ascendancyName !== 'Ascendant') {
    return false;
  }

  if (node.name?.startsWith(ASCENDANT_ALTERNATE_START_NAME_PREFIX)) {
    return true;
  }

  return (node.stats ?? []).some((stat) => stat.startsWith(ASCENDANT_ALTERNATE_START_STAT_PREFIX));
}

export function shouldHideTreeConnection(
  fromNode: TreeConnectionNode,
  toNode: TreeConnectionNode
): boolean {
  if (fromNode.isAscendancyStart || toNode.isAscendancyStart) {
    const startNode = fromNode.isAscendancyStart ? fromNode : toNode;
    const otherNode = fromNode.isAscendancyStart ? toNode : fromNode;

    return otherNode.ascendancyName !== startNode.ascendancyName;
  }

  const fromIsAscendantAlternateStart = isAscendantAlternateStartNode(fromNode);
  const toIsAscendantAlternateStart = isAscendantAlternateStartNode(toNode);

  if (fromIsAscendantAlternateStart && !toNode.ascendancyName) {
    return true;
  }

  if (toIsAscendantAlternateStart && !fromNode.ascendancyName) {
    return true;
  }

  return false;
}
