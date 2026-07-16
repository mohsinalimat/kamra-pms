import { useState } from "react"
import { Upload } from "lucide-react"
import { ResourceScreen } from "../components/ResourceScreen"
import { Button } from "../components/ui/button"
import { useAuth } from "../lib/auth"
import { menuItemsConfig } from "./configs"
import MenuImport from "./MenuImport"

/** The Menu screen: the generic resource list plus bulk upload. Menu Item is
 * writable by Finance / Hotel Admin / System Manager (Front Desk is read-only
 * on the doctype), so the import button follows the same line. */

const MENU_WRITE_ROLES = [
  "Finance",
  "Hotel Admin",
  "System Manager",
  "Administrator",
]

export default function MenuItems() {
  const { roles } = useAuth()
  const canImport = roles.some((r) => MENU_WRITE_ROLES.includes(r))
  const [importing, setImporting] = useState(false)
  // bumping the key remounts the list so imported rows show up
  const [reloadKey, setReloadKey] = useState(0)

  return (
    <>
      <ResourceScreen
        key={reloadKey}
        config={menuItemsConfig}
        headerAction={
          canImport ? (
            <Button variant="outline" onClick={() => setImporting(true)}>
              <Upload className="mr-1 size-4" aria-hidden />
              Bulk upload
            </Button>
          ) : undefined
        }
      />
      {importing && (
        <MenuImport
          onClose={() => setImporting(false)}
          onDone={() => setReloadKey((k) => k + 1)}
        />
      )}
    </>
  )
}
