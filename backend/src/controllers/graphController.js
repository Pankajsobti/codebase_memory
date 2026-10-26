import GraphNode from '../models/GraphNode.js';
import GraphEdge from '../models/GraphEdge.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

// Maps the ?type= query param to the underlying node/edge type(s) to filter by.
const GRAPH_TYPE_CONFIG = {
  dependency: {
    nodeTypes: ['file'],
    edgeTypes: ['imports'],
  },
  call: {
    nodeTypes: ['function', 'class'],
    edgeTypes: ['calls'],
  },
};

/**
 * GET /api/v1/repos/:repoId/graph?type=dependency|call
 * Returns { nodes: [...], edges: [...] } shaped for a graph viz library.
 * If `type` is omitted or unrecognized, returns all nodes/edges for the repo.
 */
export const getGraph = asyncHandler(async function getGraph(req, res, next) {
  const { repoId } = req.params;
  const { type } = req.query;

  const graphType = type && GRAPH_TYPE_CONFIG[type] ? type : null;

  const nodeQuery = { repoId };
  const edgeQuery = { repoId };

  if (graphType) {
    nodeQuery.type = { $in: GRAPH_TYPE_CONFIG[graphType].nodeTypes };
    edgeQuery.type = { $in: GRAPH_TYPE_CONFIG[graphType].edgeTypes };
  }

  const [nodeDocs, edgeDocs] = await Promise.all([
    GraphNode.find(nodeQuery).lean(),
    GraphEdge.find(edgeQuery).lean(),
  ]);

  const nodes = nodeDocs.map((n) => ({
    nodeId: n.nodeId,
    label: n.label,
    type: n.type,
    filePath: n.filePath,
    metadata: n.metadata || {},
  }));

  const edges = edgeDocs.map((e) => ({
    source: e.source,
    target: e.target,
    type: e.type,
  }));

  return res.status(200).json({ nodes, edges });
});

export default { getGraph };