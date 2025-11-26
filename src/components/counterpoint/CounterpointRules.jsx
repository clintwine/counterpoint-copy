import React from 'react';
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const RULE_CATEGORIES = {
  melodic: {
    label: 'Melodic',
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  },
  harmonic: {
    label: 'Harmonic',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  },
  motion: {
    label: 'Motion',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
  }
};

export default function CounterpointRules({ species, violations = [] }) {
  const rules = getRulesForSpecies(species);

  return (
    <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium">Counterpoint Rules</h3>
        <Badge variant="outline" className="bg-gold/10 text-gold border-gold/30 text-xs">
          {species} Species
        </Badge>
      </div>

      <div className="space-y-3">
        {rules.map((rule, index) => {
          const violation = violations.find(v => v.ruleId === rule.id);
          const category = RULE_CATEGORIES[rule.category];
          
          return (
            <motion.div
              key={rule.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex items-start gap-3 p-3 rounded-lg ${
                violation ? 'bg-red-500/10' : 'bg-slate-900/30'
              }`}
            >
              <div className="mt-0.5">
                {violation ? (
                  <XCircle className="w-4 h-4 text-red-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white text-sm font-medium">{rule.name}</span>
                  <Badge className={`${category.color} text-[10px] px-1.5 py-0`}>
                    {category.label}
                  </Badge>
                </div>
                <p className="text-white/70 text-xs leading-relaxed">{rule.description}</p>
                {violation && (
                  <p className="text-red-400/80 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {violation.message}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function getRulesForSpecies(species) {
  const baseRules = [
    {
      id: 'parallel-fifths',
      name: 'No Parallel Fifths',
      description: 'Parallel perfect fifths between voices are forbidden.',
      category: 'motion'
    },
    {
      id: 'parallel-octaves',
      name: 'No Parallel Octaves',
      description: 'Parallel octaves or unisons between voices are forbidden.',
      category: 'motion'
    },
    {
      id: 'contrary-motion',
      name: 'Prefer Contrary Motion',
      description: 'Voices should generally move in opposite directions.',
      category: 'motion'
    },
    {
      id: 'stepwise',
      name: 'Stepwise Motion',
      description: 'Prefer stepwise melodic motion over large leaps.',
      category: 'melodic'
    },
    {
      id: 'leap-resolution',
      name: 'Leap Resolution',
      description: 'Large leaps should be followed by stepwise motion in opposite direction.',
      category: 'melodic'
    },
    {
      id: 'consonance',
      name: 'Consonant Intervals',
      description: 'Use consonant intervals (3rds, 5ths, 6ths, octaves) on strong beats.',
      category: 'harmonic'
    }
  ];

  const speciesRules = {
    '1st': [
      {
        id: 'whole-notes',
        name: 'Whole Notes Only',
        description: 'First species uses one note against one note.',
        category: 'melodic'
      }
    ],
    '2nd': [
      {
        id: 'half-notes',
        name: 'Half Notes',
        description: 'Two notes against each cantus firmus note.',
        category: 'melodic'
      },
      {
        id: 'passing-tone',
        name: 'Passing Tones',
        description: 'Dissonance allowed on weak beats as passing tones.',
        category: 'harmonic'
      }
    ],
    '3rd': [
      {
        id: 'quarter-notes',
        name: 'Quarter Notes',
        description: 'Four notes against each cantus firmus note.',
        category: 'melodic'
      }
    ],
    '4th': [
      {
        id: 'suspensions',
        name: 'Suspensions',
        description: 'Syncopated rhythm with prepared dissonances.',
        category: 'harmonic'
      }
    ],
    '5th': [
      {
        id: 'florid',
        name: 'Florid Counterpoint',
        description: 'Combines all previous species techniques.',
        category: 'melodic'
      }
    ]
  };

  return [...baseRules, ...(speciesRules[species] || [])];
}