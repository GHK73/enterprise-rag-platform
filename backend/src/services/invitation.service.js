// backend/src/services/invitation.service.js

import crypto from "crypto";
import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import {
    hasPermission,
} from "./permission.service.js";

export const createInvitation = async(
    userId,
    invitationData
)=>{
    const {
        email,
        unitId,
        role
    } = invitationData;

    const user = await prisma.user.findUnique({
        where:{
            id: userId
        },
        include:{
            unit: true
        }
    });

    if(!user){
        throw new ApiError(404,"User not Found");
    }

    if(!user.unitId || !user.unit){
        throw new ApiError(
            404,
            "User does not belong to an organization"
        );
    }

    const targetUnit = await prisma.organizationUnit.findUnique({
        where:{
            id: unitId
        }
    });

    if(!targetUnit){
        throw new ApiError(
            404,
            "Organization unit not Found"
        );
    }

    if(
        targetUnit.organizationId !==
        user.unit.organizationId
    ){
        throw new ApiError(
            403,
            "Organization unit does not belong to your organization"
        );
    }

    const canInvite = await hasPermission(
        userId,
        "INVITE_MEMBER",
        unitId
    );

    if(!canInvite){
        throw new ApiError(
            403,
            "You do not have permission to invite members to this unit"
        );
    }

    let invitationRole = "MEMBER";

    if(role && role !== "MEMBER"){
        const canAssignRole = await hasPermission(
            userId,
            "ASSIGN_ROLE",
            unitId
        );

        if(!canAssignRole){
            throw new ApiError(
                403,
                "You do not have permission to assign this role"
            );
        }

        invitationRole = role;
    }

    const existingMember = await prisma.user.findUnique({
        where:{
            email
        }
    });

    if(existingMember?.unitId){
        throw new ApiError(
            400,
            "User already belongs to an organization"
        );
    }

    const existingInvitation = await prisma.invitation.findFirst({
        where:{
            email,
            organizationId: user.unit.organizationId,
            status: "PENDING",
            expiresAt:{
                gt: new Date()
            }
        }
    });

    if(existingInvitation){
        throw new ApiError(
            400,
            "A pending invitation already exists for this email"
        );
    }

    const token = crypto.randomBytes(32).toString("hex");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.invitation.create({
        data:{
            email,
            organizationId: user.unit.organizationId,
            unitId,
            role: invitationRole,
            invitedById: userId,
            token,
            expiresAt
        },
        include:{
            unit:{
                select:{
                    id: true,
                    name: true,
                    type: true
                }
            }
        }
    });

    return invitation;
};

export const getInvitations = async(userId)=>{
    const user = await prisma.user.findUnique({
        where:{
            id: userId
        },
        include:{
            unit: true
        }
    });

    if(!user){
        throw new ApiError(404,"User not Found");
    }

    if(!user.unitId || !user.unit){
        throw new ApiError(
            404,
            "User does not belong to an organization"
        );
    }

    const invitations = await prisma.invitation.findMany({
        where:{
            organizationId: user.unit.organizationId
        },
        include:{
            unit:{
                select:{
                    id: true,
                    name: true,
                    type: true
                }
            },
            invitedBy:{
                select:{
                    id: true,
                    fullName: true,
                    email: true
                }
            }
        },
        orderBy:{
            createdAt: "desc"
        }
    });

    return invitations;
};

export const acceptInvitation = async(
    userId,
    token
)=>{
    return runSerializableTransaction(async(tx)=>{
        const user = await tx.user.findUnique({
            where:{
                id:userId
            }
        });

        if(!user){
            throw new ApiError(
                404,
                "User not Found"
            );
        }

        if(user.unitId){
            throw new ApiError(
                400,
                "User already belongs to an organization"
            );
        }

        const invitation =
            await tx.invitation.findUnique({
                where:{
                    token
                },
                include:{
                    unit:true
                }
            });

        if(!invitation){
            throw new ApiError(
                404,
                "Invitation not Found"
            );
        }

        if(invitation.status !== "PENDING"){
            throw new ApiError(
                400,
                "Invitation is no longer active"
            );
        }

        if(invitation.expiresAt <= new Date()){
            await tx.invitation.update({
                where:{
                    id:invitation.id
                },
                data:{
                    status:"EXPIRED"
                }
            });

            throw new ApiError(
                400,
                "Invitation has expired"
            );
        }

        if(
            invitation.email.toLowerCase() !==
            user.email.toLowerCase()
        ){
            throw new ApiError(
                403,
                "Invitation does not belong to this user"
            );
        }

        const unit =
            await tx.organizationUnit.findUnique({
                where:{
                    id:invitation.unitId
                },
                include:{
                    _count:{
                        select:{
                            users:true
                        }
                    },
                    children:{
                        select:{
                            allocatedCapacity:true
                        }
                    }
                }
            });

        if(!unit){
            throw new ApiError(
                404,
                "Organization unit not Found"
            );
        }

        if(unit.allocatedCapacity === null){
            throw new ApiError(
                400,
                "Unit capacity has not been configured"
            );
        }

        const childAllocations =
            unit.children.reduce(
                (total,child)=>{
                    return total +
                        (child.allocatedCapacity || 0);
                },
                0
            );

        const remainingCapacity =
            unit.allocatedCapacity -
            unit._count.users -
            childAllocations;

        if(remainingCapacity <= 0){
            throw new ApiError(
                400,
                "Organization unit has reached its capacity"
            );
        }

        const updatedUser =
            await tx.user.update({
                where:{
                    id:userId
                },
                data:{
                    unitId:invitation.unitId,
                    role:invitation.role
                }
            });

        await tx.invitation.update({
            where:{
                id:invitation.id
            },
            data:{
                status:"ACCEPTED"
            }
        });

        await incrementOrganizationRevision(
            invitation.organizationId,
            tx
        );

        return updatedUser;
    });
};

export const revokeInvitation = async(
    userId,
    invitationId
)=>{
    const invitation = await prisma.invitation.findUnique({
        where:{
            id: invitationId
        }
    });

    if(!invitation){
        throw new ApiError(
            404,
            "Invitation not Found"
        );
    }

    if(invitation.status !== "PENDING"){
        throw new ApiError(
            400,
            "Only pending invitations can be revoked"
        );
    }

    if(invitation.invitedById !== userId){
        throw new ApiError(
            403,
            "You cannot revoke this invitation"
        );
    }

    const revokedInvitation = await prisma.invitation.update({
        where:{
            id: invitationId
        },
        data:{
            status: "REVOKED"
        }
    });

    return revokedInvitation;
};

export const getReceivedInvitations = async(userId)=>{
    const user = await prisma.user.findUnique({
        where:{
            id: userId
        }
    });

    if(!user){
        throw new ApiError(404,"User not Found");
    }

    const invitations = await prisma.invitation.findMany({
        where:{
            email:{
                equals: user.email,
                mode: "insensitive"
            },
            status: "PENDING",
            expiresAt:{
                gt: new Date()
            }
        },
        include:{
            organization:{
                select:{
                    id: true,
                    name: true
                }
            },
            unit:{
                select:{
                    id: true,
                    name: true,
                    type: true
                }
            },
            invitedBy:{
                select:{
                    id: true,
                    fullName: true
                }
            }
        },
        orderBy:{
            createdAt: "desc"
        }
    });

    return invitations;
};