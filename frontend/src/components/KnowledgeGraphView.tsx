import React, { useState, useEffect } from 'react';
import { Application } from '../types';
import { api } from '../api';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Network, AlertCircle, RefreshCw } from 'lucide-react';

interface KnowledgeGraphViewProps {
  application: Application;
}

export const KnowledgeGraphView: React.FC<KnowledgeGraphViewProps> = ({ application }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGraph = async () => {
    try {
      setLoading(true);
      const data = await api.getKnowledgeGraph(application.id);
      
      const formattedNodes: Node[] = data.nodes.map((n: any) => ({
        id: n.id,
        position: n.position,
        data: {
          label: (
            <div className={`p-3 rounded-xl border text-left shadow-md min-w-[160px] ${
              n.type === 'institution' ? 'bg-slate-900 text-white border-emerald-500 ring-2 ring-emerald-500/30' :
              n.type === 'trust' ? 'bg-blue-900 text-white border-blue-400' :
              n.type === 'document' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700' :
              n.type === 'finding' ? 'bg-rose-50 text-rose-900 border-rose-500 ring-2 ring-rose-500/20' :
              n.data?.has_conflict ? 'bg-rose-100 text-rose-900 border-rose-500 font-bold' :
              'bg-emerald-50 text-emerald-900 border-emerald-500'
            }`}>
              <div className="text-[9px] font-bold uppercase tracking-wider opacity-75">{n.data?.category}</div>
              <div className="font-bold text-xs mt-0.5 truncate max-w-[200px]">{n.data?.label}</div>
              {n.data?.sublabel && <div className="text-[10px] opacity-80 mt-1">{n.data?.sublabel}</div>}
            </div>
          )
        }
      }));

      const formattedEdges: Edge[] = data.edges.map((e: any) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: e.animated,
        style: e.style,
        labelStyle: { fill: e.style?.stroke === '#ef4444' ? '#ef4444' : '#64748b', fontWeight: 600, fontSize: 10 }
      }));

      setNodes(formattedNodes);
      setEdges(formattedEdges);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
  }, [application.id]);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Network className="w-5 h-5 text-emerald-600" />
            <span>Cross-Document Entity Knowledge Graph</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Visual topology mapping relationships between institution, documents, revenue survey parcels, and discrepancy conflicts.
          </p>
        </div>

        <button
          onClick={loadGraph}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg text-slate-700 dark:text-slate-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Reset View</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-[540px] relative">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            Constructing Entity Knowledge Graph...
          </div>
        ) : (
          <ReactFlow nodes={nodes} edges={edges} fitView>
            <Background gap={16} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(n: any) => {
                if (n.id.startsWith('inst')) return '#0f172a';
                if (n.id.startsWith('trust')) return '#1e3a8a';
                if (n.id.startsWith('finding')) return '#ef4444';
                return '#cbd5e1';
              }}
            />
          </ReactFlow>
        )}
      </div>
    </div>
  );
};
