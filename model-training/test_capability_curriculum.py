import unittest

from capability_curriculum import curriculum, capability_names


class CapabilityCurriculumTests(unittest.TestCase):
    def test_required_production_capabilities_present(self):
        required = {"epistemics", "conversation", "paint", "blender", "computer", "coding", "research", "image", "video", "music", "voice", "documents", "data-analysis", "memory", "security", "failure_recovery", "multilingual"}
        self.assertTrue(required.issubset(set(capability_names())))

    def test_records_are_training_eligible_and_conversational(self):
        rows = list(curriculum())
        self.assertGreaterEqual(len(rows), 25)
        for row in rows:
            self.assertTrue(row["eligible_for_training"])
            self.assertEqual(row["consent_scope"], "synthetic-curriculum")
            roles = {message["role"] for message in row["messages"]}
            self.assertIn("user", roles)
            self.assertIn("assistant", roles)

    def test_blender_trace_has_create_verify_and_render(self):
        rows = [row for row in curriculum() if row["metadata"].get("capability") == "blender"]
        operations = {trace["arguments"].get("operation") for row in rows for trace in row["metadata"].get("tool_trace", []) if trace.get("tool") == "blender"}
        self.assertTrue({"create_model", "verify", "render"}.issubset(operations))

    def test_anti_glazing_and_emotional_attunement_exist(self):
        categories = {row["metadata"].get("category") for row in curriculum()}
        self.assertIn("anti_glazing", categories)
        self.assertIn("emotional_attunement", categories)
        self.assertIn("source_checking", categories)


if __name__ == "__main__":
    unittest.main()
