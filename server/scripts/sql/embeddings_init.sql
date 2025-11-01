-- Idempotent DDL for pgvector embeddings database
-- Run this script to initialize the conversation_summaries table

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create conversation summaries table with pgvector support
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  user_id INT NOT NULL,
  summary TEXT NOT NULL,
  embedding VECTOR(1536), -- text-embedding-3-small dimensions
  importance INT DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_conv_sum_user_id ON conversation_summaries (user_id);
CREATE INDEX IF NOT EXISTS idx_conv_sum_created ON conversation_summaries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_sum_conversation_id ON conversation_summaries (conversation_id);

-- Note: ANN (Approximate Nearest Neighbor) index should be added later
-- when you have >1000 rows for better performance:
--
-- CREATE INDEX idx_conv_sum_embedding ON conversation_summaries
-- USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
--
-- For smaller datasets, sequential scan is often faster than ANN index

-- Optional: Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_summaries_updated_at
  BEFORE UPDATE ON conversation_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
