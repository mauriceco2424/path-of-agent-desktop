export interface ClusterJewel {
  name: string;
  size: 'Small' | 'Medium' | 'Large';
  type?: string;
  notableCount?: number;
  sockets?: number;
  [key: string]: unknown;
}
