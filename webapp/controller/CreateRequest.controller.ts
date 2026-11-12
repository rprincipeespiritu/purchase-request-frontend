import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import MessageToast from "sap/m/MessageToast";
import JSONModel from "sap/ui/model/json/JSONModel";
import DatePicker from "sap/m/DatePicker";
import TextArea from "sap/m/TextArea";
import Button from "sap/m/Button";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import ODataListBinding from "sap/ui/model/odata/v4/ODataListBinding";
import MessageBox from "sap/m/MessageBox";

interface PurchaseItem {
    description: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

interface PurchaseForm {
    items: PurchaseItem[];
    totalAmount: number;
}

/**
 * @namespace com.portfolio.purchase.purchaserequestfrontend.controller
 */
export default class CreateRequest extends Controller {

    public onInit(): void {
        const oModel = new JSONModel({
            items: [],
            totalAmount: 0
        } as PurchaseForm);

        this.getView()?.setModel(oModel, "form");
    }

    private getFormModel(): JSONModel {
        return this.getView()!.getModel("form") as JSONModel;
    }

    public onNavBack(): void {
        UIComponent.getRouterFor(this).navTo("RouteView1");
    }

    public onAddItem(): void {
        const oModel = this.getFormModel();

        const aItems = [
            ...(oModel.getProperty("/items") as PurchaseItem[])
        ];

        aItems.push({
            description: "",
            quantity: 1,
            unitPrice: 0,
            subtotal: 0
        });

        oModel.setProperty("/items", aItems);
    }

    public onRemoveItem(oEvent: any): void {
        const oButton = oEvent.getSource() as Button;
        const oContext = oButton.getBindingContext("form");

        if (!oContext) {
            return;
        }

        const sPath = oContext.getPath();
        const iIndex = Number(sPath.split("/").pop());

        const oModel = this.getFormModel();

        const aItems = [
            ...(oModel.getProperty("/items") as PurchaseItem[])
        ];

        aItems.splice(iIndex, 1);

        oModel.setProperty("/items", aItems);
        this.calculateTotal();
    }

    public onItemChange(): void {
        this.calculateTotal();
    }

    private calculateTotal(): void {
        const oModel = this.getFormModel();

        const aItems =
            oModel.getProperty("/items") as PurchaseItem[];

        let nTotal = 0;

        aItems.forEach((oItem, iIndex) => {
            const nQuantity = Number(oItem.quantity) || 0;
            const nUnitPrice = Number(oItem.unitPrice) || 0;

            const nSubtotal =
                Math.round(nQuantity * nUnitPrice * 100) / 100;

            oModel.setProperty(
                `/items/${iIndex}/subtotal`,
                nSubtotal
            );

            nTotal += nSubtotal;
        });

        oModel.setProperty(
            "/totalAmount",
            Math.round(nTotal * 100) / 100
        );
    }

    public async onSaveDraft(): Promise<void> {

        const oDatePicker =
            this.byId("requestDate") as DatePicker;

        const oJustification =
            this.byId("justification") as TextArea;

        const sDate = oDatePicker.getValue();
        const sJustification =
            oJustification.getValue().trim();

        const oFormModel = this.getFormModel();

        const aItems = oFormModel.getProperty("/items") as PurchaseItem[];

        if (!sDate || !sJustification) {
            MessageBox.warning(
                "Complete la fecha y la justificación."
            );
            return;
        }

        if (!aItems.length) {
            MessageBox.warning(
                "Agregue al menos un producto o servicio."
            );
            return;
        }

        const aPayloadItems = [];

        for (const item of aItems) {
            const quantity = Number(item.quantity);
            const unitPrice = Number(item.unitPrice);

            if (
                !item.description?.trim() ||
                !Number.isInteger(quantity) ||
                quantity <= 0 ||
                !Number.isFinite(unitPrice) ||
                unitPrice <= 0
            ) {
                MessageBox.warning(
                    "Revise la descripción, cantidad y precio de los productos."
                );
                return;
            }

            aPayloadItems.push({
                product: item.description.trim(),
                quantity,
                unitPrice: unitPrice.toFixed(2)
            });
        }

        const oPayload = {
            requestDate: sDate,
            justification: sJustification,
            items: aPayloadItems
        };

        try {
            const oModel =
                this.getOwnerComponent().getModel() as ODataModel;

            const oBinding = oModel.bindList(
                "/PurchaseRequests",
                undefined,
                undefined,
                undefined,
                { $$updateGroupId: "$direct" }
            ) as ODataListBinding;

            const oContext = oBinding.create(oPayload);

            await oContext.created();

            MessageToast.show(
                "Solicitud guardada correctamente"
            );

            UIComponent.getRouterFor(this).navTo("RouteView1");

        } catch (error) {
            console.error("Error al guardar solicitud:", error);

            MessageBox.error(
                "No fue posible guardar la solicitud de compra."
            );
        }
    }
}
