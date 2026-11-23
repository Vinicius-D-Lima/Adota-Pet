-- Chat da solicitação (#22): ID crescente gerado pelo banco, sem colisão de
-- chave primária quando duas mensagens são enviadas ao mesmo tempo.
CREATE SEQUENCE IF NOT EXISTS chat_message_id_seq START WITH 1;
SELECT setval(
    'chat_message_id_seq',
    GREATEST(
        COALESCE((SELECT MAX(SUBSTRING("id" FROM 'MSG-([0-9]+)$')::integer) FROM "ChatMessage"), 1),
        1
    ),
    true
);
