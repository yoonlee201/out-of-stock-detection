
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id VARCHAR(255) UNIQUE,
    folder_id VARCHAR(255) UNIQUE,
    name VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id UUID REFERENCES users (id) NOT NULL,
    token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid (),
    expires TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS google_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id UUID REFERENCES users (id) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_type TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO users (name, email) VALUES
('Alice', 'alice@example.com'),
('Bob', 'bob@example.com'),
('Charlie', 'charlie@example.com'),
('David', 'davie@example.com');

CREATE TABLE IF NOT EXISTS datasources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    
    name VARCHAR(255) NOT NULL UNIQUE, 
    description TEXT DEFAULT NULL,

    format VARCHAR(80),
    size BIGINT DEFAULT 0,

    category VARCHAR(100) DEFAULT NULL,

    relevance VARCHAR(50),
    modalities VARCHAR(100),

    datacount INTEGER DEFAULT 0,
    source VARCHAR(100),
    license VARCHAR(100) DEFAULT NULL,

    download_url VARCHAR(500),
    view_url VARCHAR(500),
    
    columns JSONB[],

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
    
);

CREATE TABLE IF NOT EXISTS userdatabases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id UUID DEFAULT NULL,
    ds_id UUID DEFAULT NULL,
    file_id VARCHAR(255) DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS websites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    website_type VARCHAR(100) DEFAULT NULL,
    website_name VARCHAR(255) DEFAULT NULL,
    website_url VARCHAR(500) DEFAULT NULL,
    ds_id UUID DEFAULT NULL
);
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id UUID REFERENCES users (id),
    ds_id UUID REFERENCES datasources (id),
    created_at TIMESTAMPTZ DEFAULT now(), 
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt TEXT,
    result TEXT,
    query_text TEXT,
    role TEXT,
    execution_time TIMESTAMPTZ DEFAULT now(), 
    created_date_time TIMESTAMPTZ DEFAULT now(), 
    modified_time TIMESTAMPTZ DEFAULT now(), 
    success_error TEXT, 
    error_message TEXT,
    conversation_id UUID REFERENCES conversations(id),
    chat_order INT,
    db_name VARCHAR(255),
    is_db_chat BOOLEAN DEFAULT FALSE NOT NULL
);


-- Populate conversations table with sample data
INSERT INTO conversations (user_id, ds_id)
VALUES
((SELECT id FROM users WHERE name = 'Alice'), (SELECT id FROM datasources LIMIT 1 OFFSET 0)),
((SELECT id FROM users WHERE name = 'Bob'), (SELECT id FROM datasources LIMIT 1 OFFSET 0)),
((SELECT id FROM users WHERE name = 'Charlie'), (SELECT id FROM datasources LIMIT 1 OFFSET 0)),
((SELECT id FROM users WHERE name = 'David'), (SELECT id FROM datasources LIMIT 1 OFFSET 0));


INSERT INTO prompts (id, conversation_id, prompt, result, query_text, role, chat_order)
SELECT gen_random_uuid(), c.id, p.prompt, p.result, p.query_text, p.role, p.chat_order
FROM (
  VALUES
    ('What is AI?', 'Artificial Intelligence is...', 'definition of AI', 'user', 1),
    ('Explain machine learning briefly.', 'Machine learning is...', 'machine learning intro', 'user', 2),
    ('Give an example of supervised learning.', 'Linear regression is...', 'supervised learning example', 'assistant', 3),
    ('List common ML algorithms.', 'Some include...', 'list algorithms', 'user', 4)
) AS p(prompt, result, query_text, role, chat_order)
CROSS JOIN LATERAL (
  SELECT id FROM conversations ORDER BY created_at ASC LIMIT 1
) AS c;


