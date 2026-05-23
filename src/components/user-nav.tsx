
"use client";

import Link from "next/link"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut, onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "./firebase-provider";
import { doc, getDoc } from "firebase/firestore";
import { useSettings } from "@/hooks/use-settings";

type UserNavProps = {
  userType?: 'admin' | 'customer' | 'staff' | 'partner' | 'corporate' | 'vendor'
}

export function UserNav({ userType = 'customer' }: UserNavProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null);
  const { auth, db } = useFirebase();
  const { settings } = useSettings();

  useEffect(() => {
    if (!auth || !db) return;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
            let photo = null;
            let collectionName = '';
             switch (userType) {
                case 'customer': collectionName = 'userProfiles'; break;
                case 'admin': collectionName = 'admins'; break;
                case 'staff': collectionName = 'staff'; break;
                case 'partner': collectionName = 'vendors'; break;
                case 'corporate': collectionName = 'corporates'; break;
                default: break;
            }

            if(collectionName) {
                const docRef = doc(db, collectionName, currentUser.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().photoURL) {
                    photo = docSnap.data().photoURL;
                }
            }
            setUserPhotoUrl(photo);
        }
    });
    return () => unsubscribe();
  }, [auth, db, userType]);

  const handleLogout = async () => {
    if (!auth) return;
    try {
        await signOut(auth);
        toast({ variant: "success", title: "Logged Out", description: "You have been successfully logged out." });
        let destination = '/login';
        if (userType === 'admin') destination = '/admin/login';
        if (userType === 'staff') destination = '/staff';
        if (userType === 'partner') destination = '/partner/login';
        if (userType === 'corporate') destination = '/corporate/login';
        router.push(destination);
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Logout Failed", description: error.message });
    }
  }

  let profile_link = "/dashboard/profile";
  if (userType === 'admin') profile_link = '/admin/profile';
  if (userType === 'staff') profile_link = '/staff/profile';
  if (userType === 'partner') profile_link = '/partner/profile';
  if (userType === 'corporate') profile_link = '/corporate/profile';
  
  const initials = user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U";
  const name = user?.displayName || user?.email?.split('@')[0] || "User";
  const email = user?.email || "";
  const logoImage = settings?.themeSettings?.logoImage;
  const avatarSrc = userPhotoUrl || (userType === 'admin' ? logoImage : null);


  if (!user) {
      return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full hover:bg-muted/50">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarSrc || undefined} alt="User avatar" data-ai-hint="user avatar" />
            <AvatarFallback className="bg-green-800 text-white">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <Link href={profile_link}>
            <DropdownMenuItem>
              Profile
              <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
            </DropdownMenuItem>
          </Link>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          Log out
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
