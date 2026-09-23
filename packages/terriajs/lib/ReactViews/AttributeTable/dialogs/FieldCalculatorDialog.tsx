import React, { useState } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";
import Button from "../../../Styled/Button";
import { fieldReference } from "../attributeExpression";
import AttributeTableController from "../AttributeTableController";
import Styles from "../attribute-table.scss";

interface Props {
  controller: AttributeTableController;
  onClose: () => void;
}

const FieldCalculatorDialog: React.FC<Props> = observer(
  function FieldCalculatorDialog({ controller, onClose }) {
    const { t } = useTranslation();
    const [targetField, setTargetField] = useState("calculated");
    const [expression, setExpression] = useState("");
    const [error, setError] = useState<string | undefined>();

    const insertField = (key: string) => {
      setExpression((prev) => `${prev}${fieldReference(key)}`);
    };

    const run = () => {
      try {
        setError(undefined);
        controller.runFieldCalculator(expression, targetField.trim());
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Invalid expression");
      }
    };

    return (
      <div
        className={Styles.dialogBackdrop}
        role="presentation"
        onClick={onClose}
      >
        <div
          className={Styles.dialog}
          role="dialog"
          aria-label={t(($) => $.attributeTable.fieldCalculator)}
          onClick={(e) => e.stopPropagation()}
        >
          <h3>{t(($) => $.attributeTable.fieldCalculator)}</h3>
          <label>
            {t(($) => $.attributeTable.targetField)}
            <input
              style={{ width: "100%", marginTop: 4 }}
              value={targetField}
              onChange={(e) => setTargetField(e.target.value)}
            />
          </label>
          <label style={{ display: "block", marginTop: 12 }}>
            {t(($) => $.attributeTable.expression)}
            <textarea
              style={{ width: "100%", minHeight: 80, marginTop: 4 }}
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="e.g. fieldA * 2 + Math.max(fieldB, 0)"
            />
          </label>
          <div
            style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}
          >
            {controller.visibleColumns.map((c) => (
              <Button
                key={c.key}
                type="button"
                onClick={() => insertField(c.key)}
              >
                {c.key}
              </Button>
            ))}
          </div>
          {error && <div className={Styles.errorBanner}>{error}</div>}
          <div className={Styles.dialogActions}>
            <Button type="button" onClick={onClose}>
              {t(($) => $.attributeTable.cancel)}
            </Button>
            <Button primary type="button" onClick={run}>
              {t(($) => $.attributeTable.apply)}
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

export default FieldCalculatorDialog;
