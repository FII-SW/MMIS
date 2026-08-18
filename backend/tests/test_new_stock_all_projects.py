"""
Verify New Stock always creates a new row for every default project.
Run from backend/: python -m unittest tests.test_new_stock_all_projects -v
"""
import unittest
from unittest.mock import MagicMock, patch

from app import crud, schemas
from app.utils.inventory_rules import DEFAULT_PROJECTS, project_requires_test_area


class TestProjectRulesAllProjects(unittest.TestCase):
    def test_skip_test_area_only_for_three_projects(self):
        skip = {"Hi-Lo", "Flying Probe", "Development"}
        for project in DEFAULT_PROJECTS:
            if project in skip:
                self.assertFalse(
                    project_requires_test_area(project),
                    f"{project} should skip test area",
                )
            else:
                self.assertTrue(
                    project_requires_test_area(project),
                    f"{project} should require test area",
                )

    def test_custom_project_requires_test_area(self):
        self.assertTrue(project_requires_test_area("My Custom Project"))


class TestInsertNewInventoryAllProjects(unittest.TestCase):
    def test_insert_never_looks_up_existing_items(self):
        db = MagicMock()
        item = schemas.InventoryBase(
            item_name="Same Name",
            item_part_number="PART-A",
            item_description="Desc A",
            item_current_quantity=10,
            item_min_count=0,
            project_name="Mandolin Beach",
            test_area="FBT_Agora",
        )
        with patch("app.crud.models.Inventory") as InventoryModel:
            mock_row = MagicMock(item_id=999)
            InventoryModel.return_value = mock_row
            result = crud.insert_new_inventory_item(db, item)

        db.query.assert_not_called()
        db.add.assert_called_once_with(mock_row)
        db.commit.assert_called_once()
        self.assertIs(result, mock_row)

    def test_insert_accepts_every_default_project(self):
        for project in DEFAULT_PROJECTS:
            with self.subTest(project=project):
                db = MagicMock()
                test_area = None if not project_requires_test_area(project) else "ICT_Mobo"
                item = schemas.InventoryBase(
                    item_name="Shared Label",
                    item_part_number=f"PN-{project}",
                    item_description=f"For {project}",
                    item_current_quantity=1,
                    item_min_count=0,
                    project_name=project,
                    test_area=test_area,
                )
                with patch("app.crud.models.Inventory") as InventoryModel:
                    mock_row = MagicMock(item_id=1, project_name=project)
                    InventoryModel.return_value = mock_row
                    crud.insert_new_inventory_item(db, item)

                db.query.assert_not_called()
                call_kwargs = InventoryModel.call_args[1]
                self.assertEqual(call_kwargs.get("project_name"), project)


class TestIdentityKeyDiffersByPartOrDescription(unittest.TestCase):
    def test_different_part_number_is_not_same_identity(self):
        base = dict(
            item_name="Oil",
            project_name="Astoria",
            test_area="TOOLS",
            item_part_number="A",
            item_description="5W30",
        )

        class Row:
            def __init__(self, **kwargs):
                for k, v in kwargs.items():
                    setattr(self, k, v)

        a = Row(**base)
        b = Row(**{**base, "item_part_number": "B"})
        self.assertNotEqual(crud._inventory_identity_key(a), crud._inventory_identity_key(b))

    def test_same_fields_across_projects_are_different_rows(self):
        class Row:
            def __init__(self, project_name):
                self.item_name = "Filter"
                self.project_name = project_name
                self.test_area = "TOOLS"
                self.item_part_number = "F-1"
                self.item_description = ""

        mandolin = Row("Mandolin Beach")
        astoria = Row("Astoria")
        self.assertNotEqual(
            crud._inventory_identity_key(mandolin),
            crud._inventory_identity_key(astoria),
        )


if __name__ == "__main__":
    unittest.main()
