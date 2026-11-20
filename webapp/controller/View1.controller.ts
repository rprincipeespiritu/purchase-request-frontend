
import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import SearchField from "sap/m/SearchField";
import Table from "sap/m/Table";
import ListItemBase from "sap/m/ListItemBase";
import ODataListBinding from "sap/ui/model/odata/v4/ODataListBinding";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import { ValueState } from "sap/ui/core/library";
import type Event from "sap/ui/base/Event";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";

interface CurrentUser {
    ID: string;
    username: string;
    fullName: string;
    email: string;
    isRequester: boolean;
    isApprover: boolean;
}

export default class View1 extends Controller {

    private _currentUser: CurrentUser | null = null;

    public onInit(): void {

        const uiModel = new JSONModel({
            loaded: false,
            isRequester: false,
            isApprover: false,
            statusFilter: "SUBMITTED",
            userName: ""
        });

        this.getView()?.setModel(uiModel, "ui");

        UIComponent.getRouterFor(this)
            .getRoute("RouteView1")
            ?.attachPatternMatched(
                this.onRouteMatched,
                this
            );
    }

    private async onRouteMatched(): Promise<void> {

        try {

            // Recargar identidad al entrar en la lista.
            await this.loadCurrentUser();

            // Aplicar filtro de estado y búsqueda.
            this.applyFilters();

            // Actualizar datos después de regresar
            // de creación o detalle.
            const table = this.byId("requestsTable") as Table;

            const binding =
                table.getBinding("items") as ODataListBinding;

            binding?.refresh();

        } catch (error) {

            MessageBox.error(
                error instanceof Error
                    ? error.message
                    : "No se pudo obtener el usuario"
            );
        }
    }



    private async loadCurrentUser(): Promise<void> {

        const uiModel = this.getView()
            ?.getModel("ui") as JSONModel;

        uiModel.setProperty("/loaded", false);
        uiModel.setProperty("/isRequester", false);
        uiModel.setProperty("/isApprover", false);

        this._currentUser = null;

        const userModel = this.getOwnerComponent()
            ?.getModel("user") as ODataModel;

        if (!userModel) {
            throw new Error(
                "No se encontró el modelo OData 'user'"
            );
        }

        // La URL base se obtiene del manifest.json.
        const operation = userModel.bindContext(
            "/getCurrentUser(...)"
        );

        await operation.invoke();

        const context = operation.getBoundContext();

        if (!context) {
            throw new Error(
                "UserService no devolvió información"
            );
        }

        const user = await context.requestObject() as CurrentUser;

        if (
            !user ||
            typeof user.isRequester !== "boolean" ||
            typeof user.isApprover !== "boolean"
        ) {
            throw new Error(
                "UserService no devolvió roles válidos"
            );
        }

        this._currentUser = user;

        uiModel.setProperty(
            "/isRequester",
            user.isRequester
        );

        uiModel.setProperty(
            "/isApprover",
            user.isApprover
        );

        uiModel.setProperty(
            "/userName",
            user.fullName ?? ""
        );

        uiModel.setProperty("/loaded", true);
    }



    private applyFilters(): void {

        if (!this._currentUser) {
            return;
        }

        const table = this.byId("requestsTable") as Table;

        const binding =
            table.getBinding("items") as ODataListBinding;

        if (!binding) {
            return;
        }

        const searchField =
            this.byId("searchField") as SearchField;

        const query = searchField.getValue().trim();

        const uiModel =
            this.getView()?.getModel("ui") as JSONModel;

        const filters: Filter[] = [];

        // Filtro por número de solicitud
        if (query) {
            filters.push(
                new Filter(
                    "requestNumber",
                    FilterOperator.Contains,
                    query
                )
            );
        }

        // Solo el Approver puede usar la bandeja
        // de pendientes, aprobadas, rechazadas y todas.
        if (this._currentUser.isApprover) {

            const status =
                uiModel.getProperty("/statusFilter") as string;

            if (status !== "ALL") {
                filters.push(
                    new Filter(
                        "status",
                        FilterOperator.EQ,
                        status
                    )
                );
            }
        }

        binding.filter(filters);
    }

    public onSearch(): void {
        this.applyFilters();
    }

    public onStatusChange(): void {
        this.applyFilters();
    }

    public formatStatusText(status: string): string {

        switch (status) {
            case "DRAFT":
                return "Borrador";
            case "SUBMITTED":
                return "Enviada";
            case "APPROVED":
                return "Aprobada";
            case "REJECTED":
                return "Rechazada";
            default:
                return status || "";
        }
    }

    public formatStatusState(status: string): ValueState {

        switch (status) {
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

        if (!this._currentUser?.isRequester) {
            MessageToast.show(
                "No tienes autorización para crear solicitudes"
            );
            return;
        }

        UIComponent.getRouterFor(this)
            .navTo("CreateRequest");
    }

    public onNavDetail(event: Event): void {

        const item = event.getSource() as ListItemBase;

        const context = item.getBindingContext();

        if (!context) {
            MessageToast.show(
                "No se pudo obtener la solicitud"
            );
            return;
        }

        const requestId =
            context.getProperty("ID") as string;

        if (!requestId) {
            MessageToast.show(
                "Identificador de solicitud inválido"
            );
            return;
        }

        UIComponent.getRouterFor(this)
            .navTo("RequestDetail", {
                requestId
            });
    }
}
