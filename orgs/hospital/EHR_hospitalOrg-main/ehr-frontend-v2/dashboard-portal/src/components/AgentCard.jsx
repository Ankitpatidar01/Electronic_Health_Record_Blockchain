import React from 'react'
import { Link } from 'react-router-dom'
import { Bot, Network as NetworkIcon, Activity } from 'lucide-react'
import { StatusPill } from './DataView'

export function AgentCard({ agentId, agent }) {
  return (
    <Link to={`/agents/${agentId}`} className="block group">
      <div className="premium-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${agent.kind === 'ai' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-cyan-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'}`}>
              {agent.kind === 'ai' ? <Bot size={22} /> : <NetworkIcon size={22} />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">{agent.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{agent.kind === 'ai' ? agent.agentId : agent.peer}</p>
            </div>
          </div>
          <StatusPill status="ONLINE" />
        </div>
        
        <div className="grid grid-cols-2 gap-3 mt-4">
          {agent.metrics.slice(0, 2).map(metric => (
            <div key={metric} className="bg-slate-50/80 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/80">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 capitalize">{metric.replace(/([A-Z])/g, ' $1').trim()}</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-1">
                <Activity size={13} className="text-blue-500 dark:text-cyan-400" />
                Active
              </div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  )
}

