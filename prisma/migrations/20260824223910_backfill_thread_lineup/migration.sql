-- The previous migration added `Thread.modelIds` as a plain nullable array with
-- no default, which is how Prisma writes a scalar list. Every thread that
-- already existed therefore holds NULL, and Prisma hands NULL back to the app as
-- an empty array rather than erroring — so nothing crashes and the thread simply
-- renders as though it had never asked anyone anything, with every stored answer
-- filtered out of the page and every follow-up refused. Silent, which is worse
-- than loud.
--
-- The line-up is recoverable for any thread that got as far as a response, so it
-- is recovered rather than defaulted: the distinct models that actually answered
-- or failed in it, which is exactly what the column would have held.
UPDATE "Thread" AS t
SET "modelIds" = recovered.ids
FROM (
  SELECT turn."threadId" AS thread_id, array_agg(DISTINCT response."modelId") AS ids
  FROM "ModelResponse" AS response
  JOIN "Turn" AS turn ON turn.id = response."turnId"
  GROUP BY turn."threadId"
) AS recovered
WHERE t.id = recovered.thread_id
  AND (t."modelIds" IS NULL OR cardinality(t."modelIds") = 0);

-- A thread whose models never answered has nothing to recover from. It becomes
-- an empty line-up rather than staying NULL, so the column holds one thing
-- meaning "no models" instead of two.
UPDATE "Thread" SET "modelIds" = ARRAY[]::TEXT[] WHERE "modelIds" IS NULL;
