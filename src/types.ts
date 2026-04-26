export enum Sentiment {
  POSITIVE = 'positive',
  NEUTRAL = 'neutral',
  NEGATIVE = 'negative',
}

export interface CRMContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  lastPurchase: string;
  notes: string;
  loyaltyTier: 'Gold' | 'Silver' | 'Bronze';
}

export interface TranscriptEntry {
  id: string;
  timestamp: Date;
  speaker: 'operator' | 'customer';
  text: string;
}

export interface AISuggestion {
  id: string;
  type: 'tactic' | 'feedback' | 'alert';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface StrategySynthesis {
  methodName: string;
  combination: string;
  benefit: string;
}

export interface AnalysisResult {
  sentiment: Sentiment;
  suggestions: AISuggestion[];
  strategy: StrategySynthesis | null;
}

export interface SalesMetric {
  label: string;
  value: string | number;
  trend: 'up' | 'down' | 'neutral';
}
