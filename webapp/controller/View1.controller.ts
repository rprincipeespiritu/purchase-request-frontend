
import Controller from "sap/ui/core/mvc/Controller";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import SearchField from "sap/m/SearchField";
import Table from "sap/m/Table";
import ODataListBinding from "sap/ui/model/odata/v4/ODataListBinding";
import MessageToast from "sap/m/MessageToast";
import { ValueState } from "sap/ui/core/library";
import UIComponent from "sap/ui/core/UIComponent";
import Event from "sap/ui/base/Event";
import ListItemBase from "sap/m/ListItemBase";


/**
 * @namespace com.portfolio.purchase.purchaserequestfrontend.controller
 */
export default class View1 extends Controller {

    public onInit(): void {

        const oRouter = UIComponent.getRouterFor(this);

        oRouter.getRoute("RouteView1")?.attachPatternMatched(
            this.onRouteMatched,
            this
        );
    }

    private onRouteMatched(_oEvent: Event): void {

        const oTable = this.byId("requestsTable") as Table;

        const oBinding = oTable.getBinding("items") as ODataListBinding;

        if (oBinding) {
            oBinding.refresh();
        }
    }

    public onSearch(): void {

        const oSearchField =
            this.byId("searchField") as SearchField;

        const sQuery = oSearchField.getValue().trim();

        const oTable =
            this.byId("requestsTable") as Table;

        const oBinding =
            oTable.getBinding("items") as ODataListBinding;

        if (!oBinding) {
            return;
        }

        const aFilters = sQuery
            ? [
                new Filter(
                    "requestNumber",
                    FilterOperator.Contains,
                    sQuery
                )
            ]
            : [];

        oBinding.filter(aFilters);
    }

    public formatStatusText(sStatus: string): string {

        switch (sStatus) {
            case "DRAFT":
                return "Borrador";

            case "SUBMITTED":
                return "Enviada";

            case "APPROVED":
                return "Aprobada";

            case "REJECTED":
                return "Rechazada";

            default:
                return sStatus || "";
        }
    }

    public formatStatusState(sStatus: string): ValueState {

        switch (sStatus) {
            case "DRAFT":
                return ValueState.None;

            case "SUBMITTED":
                return ValueState.Information;

            case "APPROVED":
                return ValueState.Success;

            case "REJECTED":
                return ValueState.Error;

            default:
                return ValueState.None;
        }
    }

    public onCreateRequest(): void {
        const oRouter = UIComponent.getRouterFor(this);
        oRouter.navTo("CreateRequest");
    }


    public onNavDetail(oEvent: Event): void {

        // Obtener la fila seleccionada
        const oItem = oEvent.getSource() as ListItemBase;

        // Obtener el contexto OData de la solicitud
        const oContext = oItem.getBindingContext();

        if (!oContext) {
            MessageToast.show(
                "No se pudo obtener la solicitud seleccionada"
            );
            return;
        }

        // Obtener el UUID de la solicitud
        const sRequestId = oContext.getProperty("ID") as string;

        if (!sRequestId) {
            MessageToast.show(
                "La solicitud no tiene un identificador válido"
            );
            return;
        }

        // Navegar al detalle
        const oRouter = UIComponent.getRouterFor(this);

        oRouter.navTo("RequestDetail", {
            requestId: sRequestId
        });
    }

}
