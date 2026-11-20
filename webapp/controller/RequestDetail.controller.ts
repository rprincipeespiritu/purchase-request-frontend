
import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import JSONModel from "sap/ui/model/json/JSONModel";
import Context from "sap/ui/model/odata/v4/Context";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import type Event from "sap/ui/base/Event";

type ActionName = "submit" | "approve" | "reject";

interface CurrentUser {
    ID: string;
    username: string;
    fullName: string;
    email: string;
    isRequester: boolean;
    isApprover: boolean;
}

interface PurchaseRequest {
    ID: string;
    status: string;
    requester_ID: string;
}

export default class RequestDetail extends Controller {

    private _requestId = "";
    private _currentUser: CurrentUser | null = null;
    private _routeVersion = 0;

    public onInit(): void {

        const uiModel = new JSONModel({
            canSubmit: false,
            canApprove: false,
            canReject: false,
            busy: false
        });

        this.getView()?.setModel(uiModel, "ui");

        UIComponent.getRouterFor(this)
            .getRoute("RequestDetail")
            ?.attachPatternMatched(
                this.onRouteMatched,
                this
            );
    }

    private async onRouteMatched(event: Event): Promise<void> {

        const parameters = event.getParameters() as unknown as {
            arguments: {
                requestId: string;
            };
        };

        const args = parameters.arguments;

        // const args = event.getParameter("arguments") as {
        //     requestId: string;
        // };

        this._requestId = args.requestId;
        const routeVersion = ++this._routeVersion;

        const view = this.getView();

        if (!view) {
            return;
        }

        const uiModel = view.getModel("ui") as JSONModel;

        uiModel.setProperty("/canSubmit", false);
        uiModel.setProperty("/canApprove", false);
        uiModel.setProperty("/canReject", false);
        uiModel.setProperty("/busy", true);

        try {

            const model = view.getModel() as ODataModel;

            // Enlazar la solicitud con sus productos
            view.bindElement({
                path: `/PurchaseRequests(${this._requestId})`,
                parameters: {
                    $expand: "items"
                }
            });

            // Consultar identidad y roles
            await this.loadCurrentUser();

            if (routeVersion !== this._routeVersion) {
                return;
            }

            await this.loadPermissions();

        } catch (error) {

            MessageBox.error(
                this.getErrorMessage(error)
            );

        } finally {

            if (routeVersion === this._routeVersion) {
                uiModel.setProperty("/busy", false);
            }
        }
    }

    private async loadCurrentUser(): Promise<void> {

        const response = await fetch(
            "/user/getCurrentUser()",
            {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                },
                credentials: "same-origin"
            }
        );

        if (!response.ok) {
            throw new Error(
                `No se pudo consultar el usuario (${response.status})`
            );
        }

        const user = await response.json() as CurrentUser;

        this._currentUser = user;
    }

    private async loadPermissions(): Promise<void> {

        const view = this.getView();

        if (!view || !this._currentUser) {
            return;
        }

        const uiModel = view.getModel("ui") as JSONModel;
        const model = view.getModel() as ODataModel;

        const binding = model.bindContext(
            `/PurchaseRequests(${this._requestId})`
        );

        const context = binding.getBoundContext();

        if (!context) {
            throw new Error(
                "No se pudo recuperar la solicitud"
            );
        }

        const request = await context.requestObject() as PurchaseRequest;

        const isRequester = this._currentUser.isRequester === true;
        const isApprover = this._currentUser.isApprover === true;

        // Comparar el propietario usando el UUID de Users
        const isOwner =
            request.requester_ID === this._currentUser.ID;

        const canSubmit =
            isRequester &&
            isOwner &&
            request.status === "DRAFT";

        const canApprove =
            isApprover &&
            request.status === "SUBMITTED";

        const canReject =
            isApprover &&
            request.status === "SUBMITTED";

        uiModel.setProperty("/canSubmit", canSubmit);
        uiModel.setProperty("/canApprove", canApprove);
        uiModel.setProperty("/canReject", canReject);
    }

    private async executeAction(
        actionName: ActionName
    ): Promise<void> {

        const view = this.getView();

        if (!view || !this._requestId) {
            return;
        }

        const uiModel = view.getModel("ui") as JSONModel;

        if (uiModel.getProperty("/busy")) {
            return;
        }

        const allowedProperty: Record<ActionName, string> = {
            submit: "/canSubmit",
            approve: "/canApprove",
            reject: "/canReject"
        };

        if (!uiModel.getProperty(allowedProperty[actionName])) {
            MessageBox.warning(
                "No tienes permisos para ejecutar esta acción."
            );
            return;
        }

        const model = view.getModel() as ODataModel;

        const actionPath =
            `/PurchaseRequests(${this._requestId})/` +
            `PurchaseRequestService.${actionName}(...)`;

        uiModel.setProperty("/busy", true);

        try {

            const action = model.bindContext(actionPath);

            // Ejecutar acción vinculada de CAP
            await action.execute();

            const messages: Record<ActionName, string> = {
                submit: "Solicitud enviada correctamente",
                approve: "Solicitud aprobada correctamente",
                reject: "Solicitud rechazada correctamente"
            };

            MessageToast.show(messages[actionName]);

            // Actualizar datos del detalle
            view.getElementBinding()?.refresh();

            // Actualizar botones según el nuevo estado
            await this.loadPermissions();

        } catch (error) {

            MessageBox.error(
                this.getErrorMessage(error)
            );

        } finally {

            uiModel.setProperty("/busy", false);
        }
    }

    public async onSubmitRequest(): Promise<void> {

        const confirmed = await this.confirmAction(
            "¿Deseas enviar esta solicitud para aprobación?"
        );

        if (confirmed) {
            await this.executeAction("submit");
        }
    }

    public async onApproveRequest(): Promise<void> {

        const confirmed = await this.confirmAction(
            "¿Deseas aprobar esta solicitud?"
        );

        if (confirmed) {
            await this.executeAction("approve");
        }
    }

    public async onRejectRequest(): Promise<void> {

        const confirmed = await this.confirmAction(
            "¿Deseas rechazar esta solicitud?"
        );

        if (confirmed) {
            await this.executeAction("reject");
        }
    }

    private confirmAction(message: string): Promise<boolean> {

        return new Promise((resolve) => {

            MessageBox.confirm(message, {
                actions: [
                    MessageBox.Action.YES,
                    MessageBox.Action.NO
                ],
                onClose: (action) => {
                    resolve(action === MessageBox.Action.YES);
                }
            });
        });
    }

    private getErrorMessage(error: unknown): string {

        if (error instanceof Error) {
            return error.message;
        }

        return "Ocurrió un error inesperado";
    }


    public formatStatusText(status: string): string {

        const statuses: Record<string, string> = {
            DRAFT: "Borrador",
            SUBMITTED: "Enviada",
            APPROVED: "Aprobada",
            REJECTED: "Rechazada"
        };

        return statuses[status] || status || "";
    }

    public formatStatusState(status: string): string {

        const states: Record<string, string> = {
            DRAFT: "None",
            SUBMITTED: "Information",
            APPROVED: "Success",
            REJECTED: "Error"
        };

        return states[status] || "None";
    }


    public onNavBack(): void {

        UIComponent.getRouterFor(this)
            .navTo("RouteView1");
    }
}
