
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

        const response = await fetch(
            "/user/getCurrentUser()",
            {
                method: "GET",
                headers: {
                    Accept: "application/json"
                },
                credentials: "same-origin"
            }
        );

        if (!response.ok) {
            throw new Error(
                "Error al obtener el usuario: " +
                response.status
            );
        }

        const user = await response.json() as CurrentUser;

        if (
            typeof user.isRequester !== "boolean" ||
            typeof user.isApprover !== "boolean"
        ) {
            throw new Error(
                "UserService no devolvió los roles del usuario"
            );
        }

        this._currentUser = user;

        const uiModel =
            this.getView()?.getModel("ui") as JSONModel;

        uiModel.setProperty("/isRequester", user.isRequester);
        uiModel.setProperty("/isApprover", user.isApprover);
        uiModel.setProperty("/userName", user.fullName);
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
