-- Een verslag per groep per KI-antwoord voorkom duplikaatklikke en misbruik.
CREATE UNIQUE INDEX "AiReport_groupId_feedbackId_key" ON "AiReport"("groupId", "feedbackId");
