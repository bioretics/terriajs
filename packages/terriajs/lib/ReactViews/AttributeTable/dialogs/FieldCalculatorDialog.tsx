import React, { useState } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import AttributeTableDialog from "../AttributeTableDialog";
import {
  DialogButton,
  DialogField,
  DialogInput,
  DialogLabel,
  DialogMutedText
} from "../AttributeTableStyles";
import { fieldReference } from "../attributeExpression";
import AttributeTableController from "../AttributeTableController";

interface Props {
  controller: AttributeTableController;
  onClose: () => void;
}

const FieldChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
`;

const ExpressionArea = styled.textarea`
  width: 100%;
  min-height: 80px;
  margin-top: 4px;
  box-sizing: border-box;
  padding: 8px;
  font-family: ${(p) => p.theme.fontMono};
  font-size: 13px;
  border: 1px solid ${(p) => p.theme.greyLighter};
  border-radius: ${(p) => p.theme.radiusSmall};
`;

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
      <AttributeTableDialog
        title={t(($) => $.attributeTable.fieldCalculator)}
        maxWidth="560px"
        onClose={onClose}
        footer={
          <>
            <DialogButton type="button" onClick={onClose}>
              {t(($) => $.attributeTable.cancel)}
            </DialogButton>
            <DialogButton type="button" onClick={run}>
              {t(($) => $.attributeTable.apply)}
            </DialogButton>
          </>
        }
      >
        <DialogField>
          <DialogLabel htmlFor="attribute-calc-target">
            {t(($) => $.attributeTable.targetField)}
          </DialogLabel>
          <DialogInput
            id="attribute-calc-target"
            value={targetField}
            onChange={(e) => setTargetField(e.target.value)}
          />
        </DialogField>
        <DialogField style={{ marginTop: 12 }}>
          <DialogLabel htmlFor="attribute-calc-expr">
            {t(($) => $.attributeTable.expression)}
          </DialogLabel>
          <ExpressionArea
            id="attribute-calc-expr"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="e.g. fieldA * 2 + Math.max(fieldB, 0)"
          />
        </DialogField>
        <FieldChips>
          {controller.visibleColumns.map((c) => (
            <DialogButton
              key={c.key}
              type="button"
              onClick={() => insertField(c.key)}
            >
              {c.key}
            </DialogButton>
          ))}
        </FieldChips>
        {error ? (
          <DialogMutedText style={{ color: "#c62828", marginTop: 12 }}>
            {error}
          </DialogMutedText>
        ) : null}
      </AttributeTableDialog>
    );
  }
);

export default FieldCalculatorDialog;
